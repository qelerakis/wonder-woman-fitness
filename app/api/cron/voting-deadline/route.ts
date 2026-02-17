/**
 * Voting Deadline Cron — Hourly
 *
 * GET /api/cron/voting-deadline
 * Secured with CRON_SECRET header.
 *
 * Locks voting on sessions where the deadline has passed.
 * This is a safety net — voting is also checked at request time in the votes API.
 */

import { prisma } from "@/lib/prisma";
import { verifyCronSecret } from "@/lib/cron-auth";

export async function GET(req: Request): Promise<Response> {
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
