/**
 * Private Sessions API — GET list, POST create
 *
 * GET /api/private-sessions — List private sessions (Owner sees all, Trainer sees own)
 * POST /api/private-sessions — Create a private session (Owner or Trainer)
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PrivateSessionSchema, DateRangeQuerySchema } from "@/types";
import { authReadLimiter, authWriteLimiter, createRateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: Request): Promise<Response> {
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

    const url = new URL(req.url);
    const queryParams: Record<string, string> = {};
    for (const [key, value] of url.searchParams.entries()) {
      queryParams[key] = value;
    }
    const parsedQuery = DateRangeQuerySchema.safeParse(queryParams);
    if (!parsedQuery.success) {
      return Response.json({ error: parsedQuery.error.flatten() }, { status: 400 });
    }

    const { startDate, endDate } = parsedQuery.data;
    const where: Record<string, unknown> = {};

    // Trainers only see their own private sessions
    if (role === "TRAINER") {
      where.createdById = session.user.id;
    }

    if (startDate || endDate) {
      where.scheduledAt = {};
      if (startDate) {
        (where.scheduledAt as Record<string, unknown>).gte = new Date(startDate);
      }
      if (endDate) {
        (where.scheduledAt as Record<string, unknown>).lte = new Date(endDate);
      }
    }

    const privateSessions = await prisma.privateSession.findMany({
      where,
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
        createdBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { scheduledAt: "desc" },
    });

    return Response.json({ data: privateSessions });
  } catch (error) {
    console.error("GET /api/private-sessions error:", error);
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
    const parsed = PrivateSessionSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Validate trainerId references an actual trainer (owner-only)
    let createdById = session.user.id;
    if (role === "OWNER" && parsed.data.trainerId) {
      const trainer = await prisma.user.findFirst({
        where: { id: parsed.data.trainerId, role: "TRAINER" },
        select: { id: true },
      });
      if (!trainer) {
        return Response.json({ error: "Invalid trainer ID" }, { status: 400 });
      }
      createdById = parsed.data.trainerId;
    }

    const privateSession = await prisma.privateSession.create({
      data: {
        clientName: parsed.data.clientName,
        scheduledAt: new Date(parsed.data.scheduledAt),
        paid: parsed.data.paid,
        amount: parsed.data.amount,
        exerciseDetails: parsed.data.exerciseDetails,
        notes: parsed.data.notes,
        createdById,
        ...(parsed.data.paid ? { paidAt: new Date(), paidMarkedById: session.user.id } : {}),
      },
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

    return Response.json({ data: privateSession }, { status: 201 });
  } catch (error) {
    console.error("POST /api/private-sessions error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
