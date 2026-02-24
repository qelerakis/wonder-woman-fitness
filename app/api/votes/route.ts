/**
 * Votes API — POST vote, GET list
 *
 * POST /api/votes — Member votes on a session (upsert, can change before deadline)
 * GET /api/votes?sessionId=X — Get votes for a session
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VoteSchema } from "@/types";
import { MAX_CLASS_SIZE } from "@/lib/constants";
import { authReadLimiter, authWriteLimiter, createRateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = VoteSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { sessionId, attending } = parsed.data;
    const userId = session.user.id;

    // Only active members can vote
    const role = session.user.role as string;
    if (role !== "MEMBER") {
      return Response.json(
        { error: "Only members can vote" },
        { status: 403 }
      );
    }

    const userStatus = session.user.status as string;
    if (userStatus !== "ACTIVE" && userStatus !== "TRIAL") {
      return Response.json(
        { error: "Only active members can vote" },
        { status: 403 }
      );
    }

    // Rate limit: 30 write requests per minute per user
    const writeRateCheck = authWriteLimiter.check(`write:${session.user.id}`);
    if (!writeRateCheck.allowed) return createRateLimitResponse(writeRateCheck.retryAfterMs);

    // Fetch session with voting info
    const targetSession = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        votingEnabled: true,
        votingDeadline: true,
        status: true,
        weekDate: true,
        customDay: true,
        recurringSlot: {
          select: { dayOfWeek: true, startHour: true },
        },
      },
    });

    if (!targetSession) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    if (targetSession.status === "CANCELLED") {
      return Response.json(
        { error: "Cannot vote on a cancelled session" },
        { status: 400 }
      );
    }

    if (!targetSession.votingEnabled) {
      return Response.json(
        { error: "Voting is not enabled for this session" },
        { status: 400 }
      );
    }

    // Check voting deadline
    if (targetSession.votingDeadline && new Date() >= targetSession.votingDeadline) {
      return Response.json(
        { error: "Voting deadline has passed" },
        { status: 400 }
      );
    }

    // "Coming" votes need a transaction to prevent race conditions on capacity
    if (attending) {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Capacity check — atomic with the upsert
        const comingCount = await tx.vote.count({
          where: { sessionId, attending: true },
        });

        if (comingCount >= MAX_CLASS_SIZE) {
          return { error: "This session is full", status: 400 } as const;
        }

        // 2. One-Coming-per-day check
        const targetDay = targetSession.recurringSlot?.dayOfWeek
          ?? targetSession.customDay;

        if (targetDay != null) {
          const existingComing = await tx.vote.findFirst({
            where: {
              userId,
              attending: true,
              sessionId: { not: sessionId },
              session: {
                weekDate: targetSession.weekDate,
                // Exclude cancelled sessions — votes on them shouldn't block new same-day votes
                status: { not: "CANCELLED" },
                OR: [
                  { recurringSlot: { dayOfWeek: targetDay } },
                  { customDay: targetDay },
                ],
              },
            },
          });

          if (existingComing) {
            return {
              error: "You're already marked as coming to another session on this day. Change that vote first.",
              status: 400,
            } as const;
          }
        }

        // 3. Upsert vote (can change vote before deadline)
        const vote = await tx.vote.upsert({
          where: {
            sessionId_userId: { sessionId, userId },
          },
          update: {
            attending,
            votedAt: new Date(),
          },
          create: {
            sessionId,
            userId,
            attending,
          },
        });

        return { data: vote };
      });

      if ("error" in result) {
        return Response.json({ error: result.error }, { status: result.status });
      }

      return Response.json({ data: result.data }, { status: 201 });
    }

    // "Not coming" case — no capacity concern, no transaction needed
    const vote = await prisma.vote.upsert({
      where: {
        sessionId_userId: { sessionId, userId },
      },
      update: {
        attending,
        votedAt: new Date(),
      },
      create: {
        sessionId,
        userId,
        attending,
      },
    });

    return Response.json({ data: vote }, { status: 201 });
  } catch (error) {
    console.error("POST /api/votes error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 60 read requests per minute per user
    const readRateCheck = authReadLimiter.check(`read:${session.user.id}`);
    if (!readRateCheck.allowed) return createRateLimitResponse(readRateCheck.retryAfterMs);

    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId) {
      return Response.json(
        { error: "sessionId query parameter is required" },
        { status: 400 }
      );
    }

    const role = session.user.role as string;
    const userId = session.user.id;

    // Owner/trainer see all votes, member sees only their own
    const where = role === "MEMBER"
      ? { sessionId, userId }
      : { sessionId };

    const votes = await prisma.vote.findMany({
      where,
      select: {
        id: true,
        userId: true,
        attending: true,
        votedAt: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { votedAt: "desc" },
    });

    return Response.json({ data: votes });
  } catch (error) {
    console.error("GET /api/votes error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
