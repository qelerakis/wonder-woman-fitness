/**
 * Session Member Assignment API — POST
 *
 * POST /api/sessions/[id]/members — Add or remove a member from a session
 * Owner or assigned Trainer can call. Members get 403.
 * Validates session exists and is not cancelled.
 * Returns updated member list for the session.
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SessionMemberAssignmentSchema } from "@/types";
import { MAX_CLASS_SIZE } from "@/lib/constants";
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

    const role = session.user.role as string;

    // Only OWNER or TRAINER can manage session members
    if (role !== "OWNER" && role !== "TRAINER") {
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
        { error: "Cannot modify members on a cancelled session" },
        { status: 400 }
      );
    }

    // If TRAINER, must be assigned to this session
    if (role === "TRAINER") {
      const trainerAssignment = await prisma.sessionTrainer.findUnique({
        where: {
          sessionId_userId: { sessionId, userId: session.user.id },
        },
      });

      if (!trainerAssignment) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Validate request body
    const body = await req.json();
    const parsed = SessionMemberAssignmentSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { userId, action } = parsed.data;

    // Validate target user exists, is a MEMBER, and is not DEPARTED
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    });

    if (!targetUser) {
      return Response.json(
        { error: "User not found" },
        { status: 400 }
      );
    }

    if (targetUser.role !== "MEMBER") {
      return Response.json(
        { error: "User is not a member" },
        { status: 400 }
      );
    }

    if (targetUser.status === "DEPARTED") {
      return Response.json(
        { error: "Cannot assign a departed member" },
        { status: 400 }
      );
    }

    if (action === "add") {
      // Use transaction to prevent TOCTOU race on capacity check
      const addResult = await prisma.$transaction(async (tx) => {
        const currentCount = await tx.sessionMember.count({
          where: { sessionId },
        });

        if (currentCount >= MAX_CLASS_SIZE) {
          return { error: "Session is at maximum capacity", status: 400 } as const;
        }

        const existing = await tx.sessionMember.findUnique({
          where: {
            sessionId_userId: { sessionId, userId },
          },
        });

        if (existing) {
          return { error: "Member is already assigned to this session", status: 409 } as const;
        }

        await tx.sessionMember.create({
          data: { sessionId, userId },
        });

        return null;
      });

      if (addResult) {
        return Response.json(
          { error: addResult.error },
          { status: addResult.status }
        );
      }
    } else {
      // action === "remove"
      const existing = await prisma.sessionMember.findUnique({
        where: {
          sessionId_userId: { sessionId, userId },
        },
      });

      if (!existing) {
        return Response.json(
          { error: "Member is not assigned to this session" },
          { status: 404 }
        );
      }

      // Use transaction to delete member and any associated vote atomically
      await prisma.$transaction(async (tx) => {
        await tx.sessionMember.delete({
          where: {
            sessionId_userId: { sessionId, userId },
          },
        });

        await tx.vote.deleteMany({
          where: { sessionId, userId },
        });
      });
    }

    // Return updated member list
    const updatedMembers = await prisma.sessionMember.findMany({
      where: { sessionId },
      include: {
        user: {
          select: { id: true, name: true, email: true, status: true },
        },
      },
    });

    const memberList = updatedMembers.map((sm) => ({
      userId: sm.user.id,
      name: sm.user.name,
      email: sm.user.email,
      status: sm.user.status,
    }));

    return Response.json({ data: memberList });
  } catch (error) {
    console.error("POST /api/sessions/[id]/members error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
