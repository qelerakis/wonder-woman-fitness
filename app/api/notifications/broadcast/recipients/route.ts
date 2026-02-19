import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPaymentStatus } from "@/lib/payment-logic";
import { BroadcastRecipientsQuerySchema } from "@/types";
import { authReadLimiter, createRateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.role !== "OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const rateLimitResult = authReadLimiter.check(`read:${session.user.id}`);
    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult.retryAfterMs);
    }

    const { searchParams } = new URL(req.url);
    const queryObj = Object.fromEntries(searchParams.entries());
    const parsed = BroadcastRecipientsQuerySchema.safeParse(queryObj);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { audience, slotId, paymentStatus } = parsed.data;
    let members: { id: string; name: string }[] = [];

    switch (audience) {
      case "ALL": {
        members = await prisma.user.findMany({
          where: { role: "MEMBER", status: { in: ["ACTIVE", "TRIAL"] } },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        });
        break;
      }
      case "TRIAL": {
        members = await prisma.user.findMany({
          where: { role: "MEMBER", status: "TRIAL" },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        });
        break;
      }
      case "SESSION_SLOT": {
        if (!slotId) {
          return Response.json({ error: "slotId is required for SESSION_SLOT audience" }, { status: 400 });
        }
        const slot = await prisma.recurringSlot.findUnique({ where: { id: slotId } });
        if (!slot) {
          return Response.json({ error: "Session slot not found" }, { status: 404 });
        }
        const sessionMembers = await prisma.sessionMember.findMany({
          where: {
            session: { recurringSlotId: slotId },
            user: { status: { in: ["ACTIVE", "TRIAL"] } },
          },
          select: { user: { select: { id: true, name: true } } },
          distinct: ["userId"],
        });
        members = sessionMembers.map((sm) => sm.user);
        break;
      }
      case "PAYMENT_STATUS": {
        if (!paymentStatus) {
          return Response.json({ error: "paymentStatus is required for PAYMENT_STATUS audience" }, { status: 400 });
        }
        const users = await prisma.user.findMany({
          where: { role: "MEMBER", status: { in: ["ACTIVE", "TRIAL"] } },
          select: {
            id: true, name: true, status: true, trialEndsAt: true, departedAt: true, overrideActive: true,
            payments: { select: { periodStart: true, periodEnd: true, paidAt: true } },
          },
          orderBy: { name: "asc" },
        });
        const today = new Date();
        members = users
          .filter((u) => getPaymentStatus(u, u.payments, today) === paymentStatus)
          .map((u) => ({ id: u.id, name: u.name }));
        break;
      }
      case "INDIVIDUAL": {
        members = await prisma.user.findMany({
          where: { role: "MEMBER", status: { in: ["ACTIVE", "TRIAL"] } },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        });
        break;
      }
    }

    return Response.json({ data: { count: members.length, members } });
  } catch (error) {
    console.error("Broadcast recipients error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
