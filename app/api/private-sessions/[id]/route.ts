/**
 * Private Session Detail API — PATCH, DELETE
 *
 * PATCH /api/private-sessions/[id] — Update a private session
 * DELETE /api/private-sessions/[id] — Delete a private session
 *
 * Owner or Trainer (trainers can only modify/delete their own).
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  MAX_PRIVATE_SESSION_EXERCISE_LENGTH,
  MAX_PRIVATE_SESSION_NOTES_LENGTH,
} from "@/lib/constants";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const PrivateSessionUpdateSchema = z.object({
  clientName: z.string().min(1).optional(),
  scheduledAt: z.string().datetime().optional(),
  paid: z.boolean().optional(),
  amount: z.number().positive().optional(),
  exerciseDetails: z.string().max(MAX_PRIVATE_SESSION_EXERCISE_LENGTH, "Exercise details too long").optional(),
  notes: z.string().max(MAX_PRIVATE_SESSION_NOTES_LENGTH, "Notes too long").optional(),
});

export async function PATCH(
  req: Request,
  { params }: RouteParams
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role as string;
    if (role !== "OWNER" && role !== "TRAINER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = PrivateSessionUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.privateSession.findUnique({
      where: { id },
      select: { id: true, createdById: true },
    });

    if (!existing) {
      return Response.json(
        { error: "Private session not found" },
        { status: 404 }
      );
    }

    // Trainers can only modify their own private sessions
    if (role === "TRAINER" && existing.createdById !== session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.clientName !== undefined) updateData.clientName = parsed.data.clientName;
    if (parsed.data.scheduledAt !== undefined) updateData.scheduledAt = new Date(parsed.data.scheduledAt);
    if (parsed.data.paid !== undefined) {
      updateData.paid = parsed.data.paid;
      if (parsed.data.paid) {
        updateData.paidAt = new Date();
        updateData.paidMarkedById = session.user.id;
      } else {
        updateData.paidAt = null;
        updateData.paidMarkedById = null;
      }
    }
    if (parsed.data.amount !== undefined) updateData.amount = parsed.data.amount;
    if (parsed.data.exerciseDetails !== undefined) updateData.exerciseDetails = parsed.data.exerciseDetails;
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

    const updated = await prisma.privateSession.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        clientName: true,
        scheduledAt: true,
        paid: true,
        amount: true,
        exerciseDetails: true,
        notes: true,
        paidAt: true,
        paidMarkedBy: { select: { id: true, name: true } },
        createdAt: true,
      },
    });

    return Response.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/private-sessions/[id] error:", error);
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

    const role = session.user.role as string;
    if (role !== "OWNER" && role !== "TRAINER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await prisma.privateSession.findUnique({
      where: { id },
      select: { id: true, createdById: true },
    });

    if (!existing) {
      return Response.json(
        { error: "Private session not found" },
        { status: 404 }
      );
    }

    // Trainers can only delete their own private sessions
    if (role === "TRAINER" && existing.createdById !== session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.privateSession.delete({ where: { id } });

    return Response.json({ data: { success: true } });
  } catch (error) {
    console.error("DELETE /api/private-sessions/[id] error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
