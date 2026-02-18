/**
 * Payment Reminders Cron — Daily at 9 AM
 *
 * GET /api/cron/payment-reminders
 * Secured with CRON_SECRET header.
 *
 * - Day 1 of month: remind all unpaid active members
 * - Day 7: second reminder
 * - Day 11: lockout notification
 */

import { prisma } from "@/lib/prisma";
import { dispatchNotification } from "@/lib/notifications";
import { getPaymentStatus } from "@/lib/payment-logic";
import type { PaymentRecord } from "@/lib/payment-logic";
import { PAYMENT_REMINDER_DAYS, GRACE_PERIOD_DAYS } from "@/lib/constants";
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
    const dayOfMonth = today.getDate();

    // Only run on reminder days (1, 7, 11)
    if (!PAYMENT_REMINDER_DAYS.includes(dayOfMonth as typeof PAYMENT_REMINDER_DAYS[number])) {
      return Response.json({ data: { message: "Not a reminder day", processed: 0 } });
    }

    // Fetch all active members with their payments
    const members = await prisma.user.findMany({
      where: {
        role: "MEMBER",
        status: { in: ["ACTIVE", "TRIAL"] },
      },
      select: {
        id: true,
        name: true,
        status: true,
        trialEndsAt: true,
        departedAt: true,
        overrideActive: true,
        payments: {
          select: {
            periodStart: true,
            periodEnd: true,
            paidAt: true,
          },
          orderBy: { paidAt: "desc" },
        },
      },
    });

    let processed = 0;

    for (const member of members) {
      const payments: PaymentRecord[] = member.payments.map((p) => ({
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        paidAt: p.paidAt,
      }));

      const paymentStatus = getPaymentStatus(
        {
          id: member.id,
          status: member.status as "TRIAL" | "ACTIVE" | "DEPARTED",
          trialEndsAt: member.trialEndsAt,
          departedAt: member.departedAt,
          overrideActive: member.overrideActive,
        },
        payments,
        today
      );

      // Skip paid, trial, override, or departed members
      if (paymentStatus !== "GRACE_PERIOD" && paymentStatus !== "LOCKED") {
        continue;
      }

      // Day 11+ (after grace period): send lockout notification
      if (dayOfMonth > GRACE_PERIOD_DAYS && paymentStatus === "LOCKED") {
        await dispatchNotification({
          userId: member.id,
          type: "LOCKOUT",
          title: "Account locked — payment overdue",
          body: "Your account has been locked due to overdue payment. Please contact the gym to make your payment and regain access.",
        });
        processed++;
        continue;
      }

      // Day 1 or 7: send payment reminder
      if (paymentStatus === "GRACE_PERIOD") {
        const daysLeft = GRACE_PERIOD_DAYS - dayOfMonth + 1;
        await dispatchNotification({
          userId: member.id,
          type: "PAYMENT_REMINDER",
          title: "Payment reminder",
          body: `Your monthly payment is due. You have ${daysLeft} days remaining in your grace period. Please make your payment to avoid account lockout.`,
        });
        processed++;
      }
    }

    return Response.json({
      data: {
        message: `Payment reminders processed for day ${dayOfMonth}`,
        processed,
      },
    });
  } catch (error) {
    console.error("Cron payment-reminders error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
