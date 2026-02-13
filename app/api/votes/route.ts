/**
 * Votes API — POST vote, GET list
 *
 * POST /api/votes — Member votes on a session (upsert, can change before deadline)
 * GET /api/votes?sessionId=X — Get votes for a session
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VoteSchema } from "@/types";

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

    // Fetch session with voting info
    const targetSession = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        votingEnabled: true,
        votingDeadline: true,
        status: true,
        members: {
          where: { userId },
          select: { userId: true },
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

    // Check that the user is a member of this session
    if (targetSession.members.length === 0) {
      return Response.json(
        { error: "You are not assigned to this session" },
        { status: 403 }
      );
    }

    // Upsert vote (can change vote before deadline)
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
