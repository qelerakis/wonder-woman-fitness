/**
 * Trial Expiration Cron — Daily at 6 AM
 *
 * GET /api/cron/trial-expiration
 * Secured with CRON_SECRET header.
 *
 * - Notify owner and member when payment deadline is approaching (2 days before)
 * - Lockout is computed automatically by getPaymentStatus() — no status transition needed
 */

import { prisma } from "@/lib/prisma";
import { dispatchNotification } from "@/lib/notifications";
import { TRIAL_EXPIRATION_WARNING_DAYS } from "@/lib/constants";
import { addDays, format } from "date-fns";
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
    const today = new Date();
    const warningDate = addDays(today, TRIAL_EXPIRATION_WARNING_DAYS);

    // Find the owner for notifications
    const owner = await prisma.user.findFirst({
      where: { role: "OWNER" },
      select: { id: true },
    });

    if (!owner) {
      return Response.json({
        data: { message: "No owner found", warnings: 0 },
      });
    }

    let warnings = 0;

    // Find trial members whose payment deadline is within the warning window
    const expiringMembers = await prisma.user.findMany({
      where: {
        status: "TRIAL",
        trialEndsAt: {
          gte: today,
          lte: warningDate,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        trialEndsAt: true,
      },
    });

    for (const member of expiringMembers) {
      // Notify owner
      await dispatchNotification({
        userId: owner.id,
        type: "TRIAL_EXPIRING",
        title: `Payment deadline approaching: ${member.name}`,
        body: `${member.name}'s payment deadline is ${member.trialEndsAt ? format(member.trialEndsAt, "MMM d, yyyy") : "unknown"}. They will be locked out if payment is not received.`,
      });

      // Notify member
      await dispatchNotification({
        userId: member.id,
        type: "TRIAL_EXPIRING",
        title: "Payment deadline approaching",
        body: `Your payment is due by ${member.trialEndsAt ? format(member.trialEndsAt, "MMM d, yyyy") : "unknown"}. Your account will be locked if payment is not received.`,
      });

      warnings++;
    }

    return Response.json({
      data: {
        message: "Trial expiration check complete",
        warnings,
      },
    });
  } catch (error) {
    console.error("Cron trial-expiration error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
