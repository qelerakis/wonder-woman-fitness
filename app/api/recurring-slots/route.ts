/**
 * Recurring Slots API — GET list, POST create, DELETE
 *
 * GET /api/recurring-slots — List all recurring time slots
 * POST /api/recurring-slots — Create a new slot
 * DELETE /api/recurring-slots — Delete a slot by ID (body: { id })
 *
 * Owner only.
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RecurringSlotSchema } from "@/types";
import { z } from "zod";

export async function GET(): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if ((session.user.role as string) !== "OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

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

    if ((session.user.role as string) !== "OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

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

    const body = await req.json();
    const parsed = DeleteSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id } = parsed.data;

    const existing = await prisma.recurringSlot.findUnique({
      where: { id },
    });

    if (!existing) {
      return Response.json(
        { error: "Recurring slot not found" },
        { status: 404 }
      );
    }

    // Delete the slot — this doesn't affect existing sessions (no cascade)
    await prisma.recurringSlot.delete({ where: { id } });

    return Response.json({ data: { success: true } });
  } catch (error) {
    console.error("DELETE /api/recurring-slots error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
