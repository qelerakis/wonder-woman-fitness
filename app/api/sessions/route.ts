/**
 * Sessions API — GET list, POST create
 *
 * GET /api/sessions?weekDate=YYYY-MM-DD — Sessions for a week
 * POST /api/sessions — Owner creates a session
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSessionsForWeek, getWeekStart } from "@/lib/session-generation";
import { SessionCreateSchema } from "@/types";
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

    if ((session.user.role as string) !== "OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = SessionCreateSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { recurringSlotId, weekDate } = parsed.data;

    // Verify the recurring slot exists
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

    // Check if session already exists for this slot+week
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

    const newSession = await prisma.session.create({
      data: {
        recurringSlotId,
        weekDate: normalizedWeekDate,
        status: "SCHEDULED",
        votingEnabled: false,
      },
      include: {
        recurringSlot: true,
      },
    });

    return Response.json({ data: newSession }, { status: 201 });
  } catch (error) {
    console.error("POST /api/sessions error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
