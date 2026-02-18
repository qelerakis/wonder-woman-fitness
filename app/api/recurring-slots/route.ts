/**
 * Recurring Slots API — GET list, POST create, DELETE
 *
 * GET /api/recurring-slots — List all recurring time slots (Owner + Trainer)
 * POST /api/recurring-slots — Create a new slot (Owner + Trainer)
 * DELETE /api/recurring-slots — Delete a slot by ID (body: { id }) (Owner only)
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RecurringSlotSchema } from "@/types";
import { z } from "zod";
import { getWeekStart } from "@/lib/session-generation";
import { dispatchNotificationToMany, getSessionNotificationRecipients, formatSessionForNotification } from "@/lib/notifications";
import { authReadLimiter, authWriteLimiter, createRateLimitResponse } from "@/lib/rate-limit";

export async function GET(): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role as string;
    if (role !== "OWNER" && role !== "TRAINER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limit: 60 read requests per minute per user
    const readRateCheck = authReadLimiter.check(`read:${session.user.id}`);
    if (!readRateCheck.allowed) return createRateLimitResponse(readRateCheck.retryAfterMs);

    const slots = await prisma.recurringSlot.findMany({
      orderBy: [{ dayOfWeek: "asc" }, { startHour: "asc" }],
      include: {
        _count: {
          select: { sessions: true },
        },
      },
    });

    return Response.json({ data: slots });
  } catch (error) {
    console.error("GET /api/recurring-slots error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role as string;
    if (role !== "OWNER" && role !== "TRAINER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limit: 30 write requests per minute per user
    const writeRateCheck = authWriteLimiter.check(`write:${session.user.id}`);
    if (!writeRateCheck.allowed) return createRateLimitResponse(writeRateCheck.retryAfterMs);

    const body = await req.json();
    const parsed = RecurringSlotSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { dayOfWeek, startHour } = parsed.data;

    // Check for duplicate slot
    const existing = await prisma.recurringSlot.findUnique({
      where: { dayOfWeek_startHour: { dayOfWeek, startHour } },
    });

    if (existing) {
      return Response.json(
        { error: "A slot already exists for this day and time" },
        { status: 409 }
      );
    }

    const slot = await prisma.recurringSlot.create({
      data: { dayOfWeek, startHour },
    });

    return Response.json({ data: slot }, { status: 201 });
  } catch (error) {
    console.error("POST /api/recurring-slots error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

const DeleteSchema = z.object({
  id: z.string().min(1, "Slot ID is required"),
  deleteFutureSessions: z.boolean().default(false),
});

export async function DELETE(req: Request): Promise<Response> {
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

    const body = await req.json();
    const parsed = DeleteSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id, deleteFutureSessions } = parsed.data;

    const existing = await prisma.recurringSlot.findUnique({
      where: { id },
    });

    if (!existing) {
      return Response.json(
        { error: "Recurring slot not found" },
        { status: 404 }
      );
    }

    let deletedSessionsCount = 0;

    if (deleteFutureSessions) {
      const currentWeekStart = getWeekStart(new Date());

      // Find all sessions from current week onward for this slot
      const futureSessions = await prisma.session.findMany({
        where: {
          recurringSlotId: id,
          weekDate: { gte: currentWeekStart },
        },
        include: {
          members: {
            include: {
              user: { select: { id: true } },
            },
          },
          votes: {
            select: { userId: true, attending: true },
          },
        },
      });

      // Notify members and delete sessions within a transaction
      await prisma.$transaction(async (tx) => {
        for (const sess of futureSessions) {
          const recipientIds = getSessionNotificationRecipients(sess);
          if (recipientIds.length > 0) {
            const { dayName, dateStr } = formatSessionForNotification(
              sess.weekDate,
              existing.dayOfWeek,
              existing.startHour
            );
            await dispatchNotificationToMany(
              recipientIds,
              "SESSION_DELETED",
              `${dayName}, ${dateStr} at ${existing.startHour}:00 class removed`,
              `The ${dayName}, ${dateStr} at ${existing.startHour}:00 recurring class has been permanently removed from the schedule.`
            );
          }
          // Cascade delete handles votes, session_members, session_trainers
          await tx.session.delete({ where: { id: sess.id } });
        }

        await tx.recurringSlot.delete({ where: { id } });
      });

      deletedSessionsCount = futureSessions.length;
    } else {
      // Delete the slot only — existing sessions are not affected
      await prisma.recurringSlot.delete({ where: { id } });
    }

    return Response.json({
      data: { deletedSlot: true, deletedSessionsCount },
    });
  } catch (error) {
    console.error("DELETE /api/recurring-slots error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
