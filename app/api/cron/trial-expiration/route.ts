/**
 * Trial Expiration Cron — Daily at 6 AM
 *
 * GET /api/cron/trial-expiration
 * Secured with CRON_SECRET header.
 *
 * - Notify owner 2 days before a member's trial expires
 * - Transition expired trials to ACTIVE status
 * - Notify the member that their trial has expired
 */

import { prisma } from "@/lib/prisma";
import { dispatchNotification } from "@/lib/notifications";
import { TRIAL_EXPIRATION_WARNING_DAYS } from "@/lib/constants";
import { addDays } from "date-fns";

export async function GET(req: Request): Promise<Response> {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
        data: { message: "No owner found", warnings: 0, expirations: 0 },
      });
    }

    let warnings = 0;
    let expirations = 0;

    // 1. Find trial members expiring soon (within warning window)
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

    // Notify owner about expiring trials
    for (const member of expiringMembers) {
      await dispatchNotification({
        userId: owner.id,
        type: "TRIAL_EXPIRING",
        title: `Trial expiring: ${member.name}`,
        body: `${member.name}'s trial period expires on ${member.trialEndsAt?.toLocaleDateString()}. They will need to make their first payment.`,
      });
      warnings++;
    }

    // 2. Find and transition expired trials
    const expiredMembers = await prisma.user.findMany({
      where: {
        status: "TRIAL",
        trialEndsAt: {
          lt: today,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    for (const member of expiredMembers) {
      // Transition to ACTIVE
      await prisma.user.update({
        where: { id: member.id },
        data: { status: "ACTIVE" },
      });

      // Notify the member
      await dispatchNotification({
        userId: member.id,
        type: "TRIAL_EXPIRED",
        title: "Your trial period has ended",
        body: "Your 14-day trial has ended. Please make your first monthly payment within the next 10 days to continue accessing classes.",
      });

      // Notify the owner
      await dispatchNotification({
        userId: owner.id,
        type: "TRIAL_EXPIRED",
        title: `Trial expired: ${member.name}`,
        body: `${member.name}'s trial period has ended. They have been moved to Active status and have a 10-day grace period for their first payment.`,
      });

      expirations++;
    }

    return Response.json({
      data: {
        message: "Trial expiration check complete",
        warnings,
        expirations,
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
