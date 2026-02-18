/**
 * Session Detail API — GET, PATCH, DELETE
 *
 * GET /api/sessions/[id] — Get session with all details
 * PATCH /api/sessions/[id] — Update workout, toggle voting, cancel
 * DELETE /api/sessions/[id] — Delete session (owner only)
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dispatchNotificationToMany, getSessionNotificationRecipients, formatSessionForNotification } from "@/lib/notifications";
import { z } from "zod";
import { authReadLimiter, authWriteLimiter, createRateLimitResponse } from "@/lib/rate-limit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const SessionUpdateSchema = z.object({
  workoutTitle: z.string().optional(),
  workoutDetails: z.string().optional(),
  votingEnabled: z.boolean().optional(),
  status: z.enum(["SCHEDULED", "CANCELLED"]).optional(),
});

export async function GET(
  _req: Request,
  { params }: RouteParams
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 60 read requests per minute per user
    const readRateCheck = authReadLimiter.check(`read:${session.user.id}`);
    if (!readRateCheck.allowed) return createRateLimitResponse(readRateCheck.retryAfterMs);

    const { id } = await params;

    const sessionData = await prisma.session.findUnique({
      where: { id },
      include: {
        recurringSlot: true,
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, status: true, photo: true },
            },
          },
        },
        trainers: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        votes: {
          select: { id: true, userId: true, attending: true, votedAt: true },
        },
      },
    });

    if (!sessionData) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    return Response.json({ data: sessionData });
  } catch (error) {
    console.error("GET /api/sessions/[id] error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: RouteParams
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const role = session.user.role as string;

    // Owner or assigned trainer can update
    if (role !== "OWNER" && role !== "TRAINER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limit: 30 write requests per minute per user
    const writeRateCheck = authWriteLimiter.check(`write:${session.user.id}`);
    if (!writeRateCheck.allowed) return createRateLimitResponse(writeRateCheck.retryAfterMs);

    const existingSession = await prisma.session.findUnique({
      where: { id },
      include: {
        trainers: { select: { userId: true } },
        members: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        votes: {
          select: { userId: true, attending: true },
        },
        recurringSlot: true,
      },
    });

    if (!existingSession) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    // Parse and validate request body
    const body: unknown = await req.json();
    const parsed = SessionUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Trainers can only update sessions they're assigned to, and only workout fields
    if (role === "TRAINER") {
      const isAssigned = existingSession.trainers.some(
        (t) => t.userId === session.user.id
      );
      if (!isAssigned) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }

      const trainerAllowedFields = ["workoutTitle", "workoutDetails"];
      const requestedFields = Object.keys(parsed.data).filter(
        (key) => parsed.data[key as keyof typeof parsed.data] !== undefined
      );
      const hasRestrictedFields = requestedFields.some(
        (f) => !trainerAllowedFields.includes(f)
      );
      if (hasRestrictedFields) {
        return Response.json(
          { error: "Trainers can only update workout details" },
          { status: 403 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};

    if (parsed.data.workoutTitle !== undefined) {
      updateData.workoutTitle = parsed.data.workoutTitle;
    }
    if (parsed.data.workoutDetails !== undefined) {
      updateData.workoutDetails = parsed.data.workoutDetails;
    }
    if (parsed.data.votingEnabled !== undefined) {
      updateData.votingEnabled = parsed.data.votingEnabled;
    }

    // Handle cancellation with notifications
    if (parsed.data.status === "CANCELLED" && existingSession.status !== "CANCELLED") {
      updateData.status = "CANCELLED";

      // Notify attending voters (if voting) or assigned members of cancellation
      const recipientIds = getSessionNotificationRecipients(existingSession);
      if (recipientIds.length > 0) {
        const dayOfWeek = existingSession.recurringSlot?.dayOfWeek ?? existingSession.customDay ?? 0;
        const startHour = existingSession.recurringSlot?.startHour ?? existingSession.customStartHour ?? 0;
        const { dayName, dateStr } = formatSessionForNotification(existingSession.weekDate, dayOfWeek, startHour);
        await dispatchNotificationToMany(
          recipientIds,
          "CLASS_CANCELLED",
          `${dayName}, ${dateStr} at ${startHour}:00 class cancelled`,
          `The ${dayName}, ${dateStr} at ${startHour}:00 class has been cancelled. Please check the schedule for alternatives.`
        );
      }
    } else if (parsed.data.status !== undefined) {
      updateData.status = parsed.data.status;
    }

    // Notify members/voters when workout is posted
    // For voting sessions, notify ALL voters (not just attending) since the workout might change minds
    if (parsed.data.workoutTitle && !existingSession.workoutTitle) {
      const recipientIds = existingSession.votingEnabled && existingSession.votes
        ? existingSession.votes.map((v) => v.userId)
        : existingSession.members.map((m) => m.user.id);
      if (recipientIds.length > 0) {
        await dispatchNotificationToMany(
          recipientIds,
          "WORKOUT_POSTED",
          "Workout posted for your upcoming class",
          `New workout: ${parsed.data.workoutTitle}`
        );
      }
    }

    // Detect actual voting state change
    const isEnablingVoting = parsed.data.votingEnabled === true && !existingSession.votingEnabled;
    const isDisablingVoting = parsed.data.votingEnabled === false && existingSession.votingEnabled;

    const updateQuery = {
      where: { id },
      data: updateData,
      include: {
        recurringSlot: true,
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    };

    let updated;

    if (isEnablingVoting) {
      // Enabling voting: clear member assignments atomically
      updated = await prisma.$transaction(async (tx) => {
        await tx.sessionMember.deleteMany({ where: { sessionId: id } });
        return tx.session.update(updateQuery);
      });
    } else if (isDisablingVoting) {
      // Disabling voting: clear votes atomically
      updated = await prisma.$transaction(async (tx) => {
        await tx.vote.deleteMany({ where: { sessionId: id } });
        return tx.session.update(updateQuery);
      });
    } else {
      // No voting toggle: simple update
      updated = await prisma.session.update(updateQuery);
    }

    return Response.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/sessions/[id] error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
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

    const { id } = await params;

    const existing = await prisma.session.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true } },
          },
        },
        votes: {
          select: { userId: true, attending: true },
        },
        recurringSlot: true,
      },
    });

    if (!existing) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    // Notify attending voters (if voting) or assigned members before deleting
    const recipientIds = getSessionNotificationRecipients(existing);
    if (recipientIds.length > 0) {
      const dayOfWeek = existing.recurringSlot?.dayOfWeek ?? existing.customDay ?? 0;
      const startHour = existing.recurringSlot?.startHour ?? existing.customStartHour ?? 0;
      const { dayName, dateStr } = formatSessionForNotification(existing.weekDate, dayOfWeek, startHour);
      await dispatchNotificationToMany(
        recipientIds,
        "SESSION_DELETED",
        `${dayName}, ${dateStr} at ${startHour}:00 class removed`,
        `The ${dayName}, ${dateStr} at ${startHour}:00 class has been removed from the schedule.`
      );
    }

    // Cascade delete handles related records (session_members, votes, etc.)
    await prisma.session.delete({ where: { id } });

    return Response.json({ data: { success: true } });
  } catch (error) {
    console.error("DELETE /api/sessions/[id] error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
