/**
 * Cleanup Pending Verifications Cron — Daily at 3 AM UTC
 *
 * GET /api/cron/cleanup-pending
 * Secured with CRON_SECRET header.
 *
 * Deletes all PendingVerification records whose expiresAt has passed.
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
    const result = await prisma.pendingVerification.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    console.log(`Cleanup: deleted ${result.count} expired pending verifications`);

    return Response.json({
      data: {
        message: "Cleanup complete",
        deleted: result.count,
      },
    });
  } catch (error) {
    console.error("Cron cleanup-pending error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
