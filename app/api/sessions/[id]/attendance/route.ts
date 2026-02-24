/**
 * Session Attendance API — POST + GET
 *
 * POST /api/sessions/[id]/attendance — Mark or toggle a member's attendance
 * GET  /api/sessions/[id]/attendance — List attendance records for a session
 *
 * Owner or assigned Trainer can call. Members get 403.
 * Session must have started (session datetime <= now).
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AttendanceMarkSchema } from "@/types";
import { getSessionDateTime } from "@/lib/session-generation";
import {
  authWriteLimiter,
  authReadLimiter,
  createRateLimitResponse,
} from "@/lib/rate-limit";

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

    // Only OWNER or TRAINER can mark attendance
    if (role !== "OWNER" && role !== "TRAINER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limit: write requests per minute per user
    const writeRateCheck = authWriteLimiter.check(`write:${session.user.id}`);
    if (!writeRateCheck.allowed) return createRateLimitResponse(writeRateCheck.retryAfterMs);

    const { id: sessionId } = await params;

    // Validate session exists with scheduling data
    const existingSession = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        status: true,
        weekDate: true,
        recurringSlotId: true,
        recurringSlot: { select: { dayOfWeek: true, startHour: true } },
        customDay: true,
        customStartHour: true,
      },
    });

    if (!existingSession) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    if (existingSession.status === "CANCELLED") {
      return Response.json(
        { error: "Cannot mark attendance on a cancelled session" },
        { status: 400 }
      );
    }

    // Compute session start time
    const dayOfWeek = existingSession.recurringSlot?.dayOfWeek ?? existingSession.customDay ?? 0;
    const startHour = existingSession.recurringSlot?.startHour ?? existingSession.customStartHour ?? 0;
    const sessionStart = getSessionDateTime(existingSession.weekDate, dayOfWeek, startHour);

    if (new Date() < sessionStart) {
      return Response.json(
        { error: "Session has not started yet" },
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
    const parsed = AttendanceMarkSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { userId, present } = parsed.data;

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
        { error: "Cannot mark attendance for a departed member" },
        { status: 400 }
      );
    }

    // Upsert attendance record
    const now = new Date();
    const record = await prisma.attendanceRecord.upsert({
      where: {
        sessionId_userId: { sessionId, userId },
      },
      create: {
        sessionId,
        userId,
        present,
        markedById: session.user.id,
        markedAt: now,
      },
      update: {
        present,
        markedById: session.user.id,
        markedAt: now,
      },
    });

    return Response.json({ data: record });
  } catch (error) {
    console.error("POST /api/sessions/[id]/attendance error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(
  _req: Request,
  { params }: RouteParams
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role as string;

    // Only OWNER or TRAINER can view attendance
    if (role !== "OWNER" && role !== "TRAINER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limit: read requests per minute per user
    const readRateCheck = authReadLimiter.check(`read:${session.user.id}`);
    if (!readRateCheck.allowed) return createRateLimitResponse(readRateCheck.retryAfterMs);

    const { id: sessionId } = await params;

    // Validate session exists
    const existingSession = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true },
    });

    if (!existingSession) {
      return Response.json({ error: "Session not found" }, { status: 404 });
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

    // Fetch attendance records with user details
    const records = await prisma.attendanceRecord.findMany({
      where: { sessionId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { user: { name: "asc" } },
    });

    return Response.json({ data: records });
  } catch (error) {
    console.error("GET /api/sessions/[id]/attendance error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
