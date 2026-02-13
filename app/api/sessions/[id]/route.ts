/**
 * Session Detail API — GET, PATCH, DELETE
 *
 * GET /api/sessions/[id] — Get session with all details
 * PATCH /api/sessions/[id] — Update workout, toggle voting, cancel
 * DELETE /api/sessions/[id] — Delete session (owner only)
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dispatchNotificationToMany } from "@/lib/notifications";
import { DAY_NAMES } from "@/lib/constants";
import { z } from "zod";

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

    const existingSession = await prisma.session.findUnique({
      where: { id },
      include: {
        trainers: { select: { userId: true } },
        members: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
        recurringSlot: true,
      },
    });

    if (!existingSession) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    // Trainers can only update sessions they're assigned to
    if (role === "TRAINER") {
      const isAssigned = existingSession.trainers.some(
        (t) => t.userId === session.user.id
      );
      if (!isAssigned) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = await req.json();
    const parsed = SessionUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
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

      // Notify all members of cancellation
      const memberIds = existingSession.members.map((m) => m.user.id);
      if (memberIds.length > 0) {
        const dayName = DAY_NAMES[existingSession.recurringSlot.dayOfWeek] || "Unknown";
        await dispatchNotificationToMany(
          memberIds,
          "CLASS_CANCELLED",
          `${dayName} ${existingSession.recurringSlot.startHour}:00 class cancelled`,
          `The ${dayName} ${existingSession.recurringSlot.startHour}:00 class has been cancelled. Please check the schedule for alternatives.`
        );
      }
    } else if (parsed.data.status !== undefined) {
      updateData.status = parsed.data.status;
    }

    // Notify members when workout is posted
    if (parsed.data.workoutTitle && !existingSession.workoutTitle) {
      const memberIds = existingSession.members.map((m) => m.user.id);
      if (memberIds.length > 0) {
        await dispatchNotificationToMany(
          memberIds,
          "WORKOUT_POSTED",
          "Workout posted for your upcoming class",
          `New workout: ${parsed.data.workoutTitle}`
        );
      }
    }

    const updated = await prisma.session.update({
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
    });

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

    const { id } = await params;

    const existing = await prisma.session.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true } },
          },
        },
        recurringSlot: true,
      },
    });

    if (!existing) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    // Notify members before deleting
    const memberIds = existing.members.map((m) => m.user.id);
    if (memberIds.length > 0) {
      const dayName = DAY_NAMES[existing.recurringSlot.dayOfWeek] || "Unknown";
      await dispatchNotificationToMany(
        memberIds,
        "SESSION_DELETED",
        `${dayName} ${existing.recurringSlot.startHour}:00 class removed`,
        `The ${dayName} ${existing.recurringSlot.startHour}:00 class has been removed from the schedule.`
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
