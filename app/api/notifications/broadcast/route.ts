import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dispatchNotificationToMany } from "@/lib/notifications";
import { getPaymentStatus } from "@/lib/payment-logic";
import { BroadcastNotificationSchema } from "@/types";
import { RateLimiter, createRateLimitResponse } from "@/lib/rate-limit";
import { BROADCAST_RATE_LIMIT_MAX, BROADCAST_RATE_LIMIT_WINDOW_MS } from "@/lib/constants";

const broadcastLimiter = new RateLimiter({
  maxRequests: BROADCAST_RATE_LIMIT_MAX,
  windowMs: BROADCAST_RATE_LIMIT_WINDOW_MS,
});

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const rateLimitResult = broadcastLimiter.check(`broadcast:${session.user.id}`);
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult.retryAfterMs);
    }

    const body = await req.json();
    const parsed = BroadcastNotificationSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { audience, slotId, paymentStatus, memberIds, title, body: messageBody } = parsed.data;
    let recipientIds: string[] = [];

    switch (audience) {
      case "ALL": {
        const users = await prisma.user.findMany({
          where: { role: "MEMBER", status: { in: ["ACTIVE", "TRIAL"] } },
          select: { id: true },
        });
        recipientIds = users.map((u) => u.id);
        break;
      }
      case "TRIAL": {
        const users = await prisma.user.findMany({
          where: { role: "MEMBER", status: "TRIAL" },
          select: { id: true },
        });
        recipientIds = users.map((u) => u.id);
        break;
      }
      case "SESSION_SLOT": {
        const slot = await prisma.recurringSlot.findUnique({ where: { id: slotId! } });
        if (!slot) {
          return Response.json({ error: "Session slot not found" }, { status: 404 });
        }
        const sessionMembers = await prisma.sessionMember.findMany({
          where: { session: { recurringSlotId: slotId! } },
          select: { userId: true },
          distinct: ["userId"],
        });
        recipientIds = sessionMembers.map((sm) => sm.userId);
        break;
      }
      case "PAYMENT_STATUS": {
        const users = await prisma.user.findMany({
          where: { role: "MEMBER", status: { in: ["ACTIVE", "TRIAL"] } },
          select: {
            id: true, status: true, trialEndsAt: true, departedAt: true, overrideActive: true,
            payments: { select: { periodStart: true, periodEnd: true, paidAt: true } },
          },
        });
        const today = new Date();
        recipientIds = users
          .filter((u) => getPaymentStatus(u, u.payments, today) === paymentStatus!)
          .map((u) => u.id);
        break;
      }
      case "INDIVIDUAL": {
        const users = await prisma.user.findMany({
          where: { id: { in: memberIds! }, role: "MEMBER", status: { in: ["ACTIVE", "TRIAL"] } },
          select: { id: true },
        });
        recipientIds = users.map((u) => u.id);
        break;
      }
    }

    const notifications = await dispatchNotificationToMany(recipientIds, "MANUAL_REMINDER", title, messageBody);
    return Response.json({ data: { sentCount: notifications.length } });
  } catch (error) {
    console.error("Broadcast notification error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
