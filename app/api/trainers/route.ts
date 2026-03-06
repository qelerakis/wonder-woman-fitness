/**
 * Trainers API — POST (Promote Member to Trainer)
 *
 * POST /api/trainers — Promote an existing member to trainer role
 * Owner only. Changes role from MEMBER to TRAINER, cleans up
 * future session assignments and votes, sends notification.
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PromoteMemberSchema } from "@/types";
import { dispatchNotification } from "@/lib/notifications";
import { authWriteLimiter, createRateLimitResponse } from "@/lib/rate-limit";
import { startOfWeek } from "date-fns";

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if ((session.user.role as string) !== "OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limit: 30 write requests per minute per user
    const writeRateCheck = authWriteLimiter.check(`write:${session.user.id}`);
    if (!writeRateCheck.allowed) return createRateLimitResponse(writeRateCheck.retryAfterMs);

    // Validate request body
    const body = await req.json();
    const parsed = PromoteMemberSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { memberId } = parsed.data;

    // Look up the member
    const member = await prisma.user.findUnique({
      where: { id: memberId },
      select: { id: true, role: true, status: true, name: true },
    });

    if (!member) {
      return Response.json({ error: "Member not found" }, { status: 404 });
    }

    if (member.role !== "MEMBER") {
      return Response.json(
        { error: "User is already a trainer or owner" },
        { status: 400 }
      );
    }

    if (member.status === "DEPARTED") {
      return Response.json(
        { error: "Cannot promote a departed member" },
        { status: 400 }
      );
    }

    // Use a transaction to atomically promote + clean up
    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

    const updatedUser = await prisma.$transaction(async (tx) => {
      // 1. Change role to TRAINER, set status to ACTIVE
      const updated = await tx.user.update({
        where: { id: memberId },
        data: { role: "TRAINER", status: "ACTIVE" },
      });

      // 2. Remove future session member assignments
      await tx.sessionMember.deleteMany({
        where: {
          userId: memberId,
          session: { weekDate: { gte: currentWeekStart } },
        },
      });

      // 3. Remove future votes
      await tx.vote.deleteMany({
        where: {
          userId: memberId,
          session: { weekDate: { gte: currentWeekStart } },
        },
      });

      return updated;
    });

    // Send notification (fire-and-forget, outside transaction)
    dispatchNotification({
      userId: memberId,
      type: "ROLE_CHANGED",
      title: "You are now a Trainer",
      body: "Your role has been changed from Member to Trainer. You now have access to trainer features including posting workouts, tracking attendance, and managing private sessions.",
    }).catch((err) => console.error("Failed to send role change notification:", err));

    // Return updated trainer list
    const trainers = await prisma.user.findMany({
      where: { role: "TRAINER" },
      select: { id: true, name: true, email: true, phone: true, status: true, createdAt: true },
      orderBy: { name: "asc" },
    });

    return Response.json({
      data: {
        role: updatedUser.role,
        trainers: trainers.map((t) => ({
          id: t.id,
          name: t.name,
          email: t.email,
          phone: t.phone,
          status: t.status,
          createdAt: t.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("POST /api/trainers error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
