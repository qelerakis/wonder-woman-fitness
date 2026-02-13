/**
 * Sessions API — GET list, POST create
 *
 * GET /api/sessions?weekDate=YYYY-MM-DD — Sessions for a week
 * POST /api/sessions — Owner or Trainer creates a session (recurring or one-off)
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getSessionsForWeek,
  getWeekStart,
  getSessionDateTime,
  calculateVotingDeadline,
} from "@/lib/session-generation";
import { SessionCreateSchema, OneOffSessionCreateSchema } from "@/types";
import type { UserRole } from "@/lib/constants";

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const weekDateParam = url.searchParams.get("weekDate");

    const weekDate = weekDateParam
      ? getWeekStart(new Date(weekDateParam))
      : getWeekStart(new Date());

    const role = session.user.role as UserRole;
    const sessions = await getSessionsForWeek(weekDate, session.user.id, role);

    return Response.json({ data: sessions });
  } catch (error) {
    console.error("GET /api/sessions error:", error);
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

    const body = await req.json();

    // Determine mode: recurring (has recurringSlotId) vs one-off (has customDay/customStartHour)
    const hasSlotId = "recurringSlotId" in body && body.recurringSlotId;
    const hasCustomDay = "customDay" in body;
    const hasCustomHour = "customStartHour" in body;
    const hasCustom = hasCustomDay || hasCustomHour;

    if (hasSlotId && hasCustom) {
      return Response.json(
        { error: "Cannot specify both recurringSlotId and custom day/hour" },
        { status: 400 }
      );
    }

    if (hasCustom && (!hasCustomDay || !hasCustomHour)) {
      return Response.json(
        { error: "Must specify both customDay and customStartHour together" },
        { status: 400 }
      );
    }

    if (!hasSlotId && !hasCustom) {
      return Response.json(
        { error: "Must specify either recurringSlotId or customDay and customStartHour" },
        { status: 400 }
      );
    }

    if (hasSlotId) {
      // === RECURRING MODE ===
      const parsed = SessionCreateSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          { error: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const { recurringSlotId, weekDate } = parsed.data;

      const slot = await prisma.recurringSlot.findUnique({
        where: { id: recurringSlotId },
      });

      if (!slot) {
        return Response.json(
          { error: "Recurring slot not found" },
          { status: 404 }
        );
      }

      const normalizedWeekDate = getWeekStart(new Date(weekDate));

      const existing = await prisma.session.findUnique({
        where: {
          recurringSlotId_weekDate: {
            recurringSlotId,
            weekDate: normalizedWeekDate,
          },
        },
      });

      if (existing) {
        return Response.json(
          { error: "Session already exists for this slot and week" },
          { status: 409 }
        );
      }

      const sessionDateTime = getSessionDateTime(
        normalizedWeekDate,
        slot.dayOfWeek,
        slot.startHour
      );
      const votingDeadline = calculateVotingDeadline(sessionDateTime);

      const newSession = await prisma.$transaction(async (tx) => {
        const created = await tx.session.create({
          data: {
            recurringSlotId,
            weekDate: normalizedWeekDate,
            votingDeadline,
            status: "SCHEDULED",
            votingEnabled: false,
            createdById: session.user.id,
          },
          include: {
            recurringSlot: true,
          },
        });

        // Auto-assign trainer if created by a trainer
        if (role === "TRAINER") {
          await tx.sessionTrainer.create({
            data: { sessionId: created.id, userId: session.user.id },
          });
        }

        return created;
      });

      return Response.json({ data: newSession }, { status: 201 });
    } else {
      // === ONE-OFF MODE ===
      const parsed = OneOffSessionCreateSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json(
          { error: parsed.error.flatten() },
          { status: 400 }
        );
      }

      const { customDay, customStartHour, weekDate } = parsed.data;
      const normalizedWeekDate = getWeekStart(new Date(weekDate));

      // Check for any session (recurring or one-off) at the same day/hour/week
      const conflict = await prisma.session.findFirst({
        where: {
          weekDate: normalizedWeekDate,
          OR: [
            { customDay, customStartHour },
            {
              recurringSlot: {
                dayOfWeek: customDay,
                startHour: customStartHour,
              },
            },
          ],
        },
      });

      if (conflict) {
        return Response.json(
          { error: "A session already exists at this day and time for this week" },
          { status: 409 }
        );
      }

      const sessionDateTime = getSessionDateTime(
        normalizedWeekDate,
        customDay,
        customStartHour
      );
      const votingDeadline = calculateVotingDeadline(sessionDateTime);

      const newSession = await prisma.$transaction(async (tx) => {
        const created = await tx.session.create({
          data: {
            customDay,
            customStartHour,
            weekDate: normalizedWeekDate,
            votingDeadline,
            status: "SCHEDULED",
            votingEnabled: false,
            createdById: session.user.id,
          },
        });

        // Auto-assign trainer if created by a trainer
        if (role === "TRAINER") {
          await tx.sessionTrainer.create({
            data: { sessionId: created.id, userId: session.user.id },
          });
        }

        return created;
      });

      return Response.json({ data: newSession }, { status: 201 });
    }
  } catch (error) {
    console.error("POST /api/sessions error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
