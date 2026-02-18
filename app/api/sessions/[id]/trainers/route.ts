/**
 * Session Trainer Assignment API — POST
 *
 * POST /api/sessions/[id]/trainers — Add or remove a trainer from a session
 * Owner only. Validates session exists and is not cancelled.
 * Returns updated trainer list for the session.
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SessionTrainerAssignmentSchema } from "@/types";
import { authWriteLimiter, createRateLimitResponse } from "@/lib/rate-limit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

    const { id: sessionId } = await params;

    // Validate session exists
    const existingSession = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true },
    });

    if (!existingSession) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    if (existingSession.status === "CANCELLED") {
      return Response.json(
        { error: "Cannot modify trainers on a cancelled session" },
        { status: 400 }
      );
    }

    // Validate request body
    const body = await req.json();
    const parsed = SessionTrainerAssignmentSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { userId, action } = parsed.data;

    // Validate target user exists and is a TRAINER or OWNER
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!targetUser) {
      return Response.json(
        { error: "User not found" },
        { status: 400 }
      );
    }

    if (targetUser.role !== "TRAINER" && targetUser.role !== "OWNER") {
      return Response.json(
        { error: "User is not a trainer or owner" },
        { status: 400 }
      );
    }

    if (action === "add") {
      // Check if already assigned
      const existing = await prisma.sessionTrainer.findUnique({
        where: {
          sessionId_userId: { sessionId, userId },
        },
      });

      if (existing) {
        return Response.json(
          { error: "Trainer is already assigned to this session" },
          { status: 409 }
        );
      }

      await prisma.sessionTrainer.create({
        data: { sessionId, userId },
      });
    } else {
      // action === "remove"
      const existing = await prisma.sessionTrainer.findUnique({
        where: {
          sessionId_userId: { sessionId, userId },
        },
      });

      if (!existing) {
        return Response.json(
          { error: "Trainer is not assigned to this session" },
          { status: 404 }
        );
      }

      await prisma.sessionTrainer.delete({
        where: {
          sessionId_userId: { sessionId, userId },
        },
      });
    }

    // Return updated trainer list
    const updatedTrainers = await prisma.sessionTrainer.findMany({
      where: { sessionId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const trainerList = updatedTrainers.map((st) => ({
      userId: st.user.id,
      name: st.user.name,
      email: st.user.email,
    }));

    return Response.json({ data: trainerList });
  } catch (error) {
    console.error("POST /api/sessions/[id]/trainers error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
