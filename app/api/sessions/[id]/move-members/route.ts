/**
 * Move Members API
 *
 * POST /api/sessions/[id]/move-members
 * Moves members from a cancelled/low-attendance session to another session.
 * The move is final — members are notified but do not confirm.
 * Owner only.
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dispatchNotificationToMany } from "@/lib/notifications";
import { MAX_CLASS_SIZE, DAY_NAMES } from "@/lib/constants";
import { z } from "zod";
import { authWriteLimiter, createRateLimitResponse } from "@/lib/rate-limit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const MoveSchema = z.object({
  targetSessionId: z.string().min(1, "Target session ID is required"),
  memberIds: z.array(z.string()).min(1, "At least one member must be specified"),
});

export async function POST(
  req: Request,
  { params }: RouteParams
): Promise<Response> {
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

    const { id: sourceSessionId } = await params;
    const body = await req.json();
    const parsed = MoveSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { targetSessionId, memberIds } = parsed.data;

    // Validate source session exists
    const sourceSession = await prisma.session.findUnique({
      where: { id: sourceSessionId },
      include: {
        recurringSlot: true,
        members: { select: { userId: true } },
      },
    });

    if (!sourceSession) {
      return Response.json(
        { error: "Source session not found" },
        { status: 404 }
      );
    }

    // Validate target session exists
    const targetSession = await prisma.session.findUnique({
      where: { id: targetSessionId },
      include: {
        recurringSlot: true,
        members: { select: { userId: true } },
      },
    });

    if (!targetSession) {
      return Response.json(
        { error: "Target session not found" },
        { status: 404 }
      );
    }

    if (targetSession.status === "CANCELLED") {
      return Response.json(
        { error: "Cannot move members to a cancelled session" },
        { status: 400 }
      );
    }

    // Check capacity
    const currentTargetSize = targetSession.members.length;
    if (currentTargetSize + memberIds.length > MAX_CLASS_SIZE) {
      return Response.json(
        {
          error: `Target session would exceed max capacity of ${MAX_CLASS_SIZE}. Current: ${currentTargetSize}, Moving: ${memberIds.length}`,
        },
        { status: 400 }
      );
    }

    // Verify all memberIds are in the source session
    const sourceMemberIds = new Set(
      sourceSession.members.map((m) => m.userId)
    );
    const invalidIds = memberIds.filter((id) => !sourceMemberIds.has(id));
    if (invalidIds.length > 0) {
      return Response.json(
        { error: `Members not in source session: ${invalidIds.join(", ")}` },
        { status: 400 }
      );
    }

    // Check which members are already in the target
    const targetMemberIds = new Set(
      targetSession.members.map((m) => m.userId)
    );
    const membersToMove = memberIds.filter((id) => !targetMemberIds.has(id));

    // Perform the move in a transaction
    await prisma.$transaction(async (tx) => {
      // Remove from source session
      await tx.sessionMember.deleteMany({
        where: {
          sessionId: sourceSessionId,
          userId: { in: memberIds },
        },
      });

      // Add to target session (skip already-present members)
      if (membersToMove.length > 0) {
        await tx.sessionMember.createMany({
          data: membersToMove.map((userId) => ({
            sessionId: targetSessionId,
            userId,
          })),
          skipDuplicates: true,
        });
      }
    });

    // Send notifications (move is final, per CLAUDE.md section 6.3)
    const sourceDayOfWeek = sourceSession.recurringSlot?.dayOfWeek ?? sourceSession.customDay ?? 0;
    const sourceStartHour = sourceSession.recurringSlot?.startHour ?? sourceSession.customStartHour ?? 0;
    const targetDayOfWeek = targetSession.recurringSlot?.dayOfWeek ?? targetSession.customDay ?? 0;
    const targetStartHour = targetSession.recurringSlot?.startHour ?? targetSession.customStartHour ?? 0;
    const sourceDayName = DAY_NAMES[sourceDayOfWeek] || "Unknown";
    const targetDayName = DAY_NAMES[targetDayOfWeek] || "Unknown";

    await dispatchNotificationToMany(
      memberIds,
      "MEMBER_MOVED",
      `You've been moved to ${targetDayName} ${targetStartHour}:00`,
      `Your ${sourceDayName} ${sourceStartHour}:00 class has been changed. You are now in the ${targetDayName} ${targetStartHour}:00 class. This change is final.`
    );

    return Response.json({
      data: {
        movedCount: membersToMove.length,
        skippedCount: memberIds.length - membersToMove.length,
        targetSessionId,
      },
    });
  } catch (error) {
    console.error("POST /api/sessions/[id]/move-members error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
