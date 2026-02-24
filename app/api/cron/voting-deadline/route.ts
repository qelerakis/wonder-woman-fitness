/**
 * Voting Deadline Cron — Runs hourly
 * Locks voting on sessions where the deadline has passed.
 */

import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";
import { cronLimiter, getClientIp, createRateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: Request): Promise<Response> {
  // Rate limit: 5 requests per minute per IP
  const ip = getClientIp(req);
  const cronRateCheck = cronLimiter.check(`cron:${ip}`);
  if (!cronRateCheck.allowed) return createRateLimitResponse(cronRateCheck.retryAfterMs);

  // Verify cron secret (timing-safe)
  if (!verifyCronSecret(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // Find sessions with passed voting deadlines that still have voting enabled
    const result = await prisma.session.updateMany({
      where: {
        votingEnabled: true,
        votingDeadline: {
          lte: now,
        },
        status: "SCHEDULED",
      },
      data: {
        votingEnabled: false,
      },
    });

    return Response.json({
      data: {
        message: "Voting deadline check complete",
        lockedCount: result.count,
      },
    });
  } catch (error) {
    console.error("Cron voting-deadline error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
