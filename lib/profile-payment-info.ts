/**
 * Profile Payment Info Computation
 *
 * Extracts payment information for the member profile page.
 * This is a pure function (given user + payments + today) that computes
 * all the display data needed by the PaymentInfoSection component.
 */

import {
  getPaymentStatus,
  getGracePeriodStart,
  getGracePeriodLength,
  getDaysBetween,
} from "@/lib/payment-logic";
import type { PaymentRecord as PaymentLogicRecord } from "@/lib/payment-logic";
import type { PaymentStatus } from "@/lib/constants";
import { addDays } from "date-fns";

/** Shape of a payment row from the database (with id + amount for display). */
export interface ProfilePaymentRow {
  id: string;
  amount: number;
  paidAt: Date;
  periodStart: Date;
  periodEnd: Date;
}

/** Shape of the user data needed for payment info computation. */
export interface ProfilePaymentUser {
  id: string;
  status: "TRIAL" | "ACTIVE" | "DEPARTED";
  trialEndsAt: Date | null;
  departedAt: Date | null;
  overrideActive: boolean;
}

/** Serialized payment record for client components. */
export interface SerializedPayment {
  id: string;
  amount: number;
  paidAt: string;
  periodStart: string;
  periodEnd: string;
}

/** The full payment info result used by the ProfileClient component. */
export interface ProfilePaymentInfo {
  status: PaymentStatus;
  daysRemaining: number | null;
  lastPaymentDate: string | null;
  paidThroughDate: string | null;
  nextPaymentDue: string | null;
  recentPayments: SerializedPayment[];
  totalPaymentCount: number;
}

/**
 * Compute all payment display info for the member profile page.
 *
 * @param user - The user's status fields
 * @param payments - The user's payments, sorted by paidAt desc
 * @param today - The current date (injectable for testing)
 * @returns ProfilePaymentInfo ready for serialization to the client
 */
export function computeProfilePaymentInfo(
  user: ProfilePaymentUser,
  payments: ProfilePaymentRow[],
  today: Date
): ProfilePaymentInfo {
  // Build payment records for status computation
  const paymentRecords: PaymentLogicRecord[] = payments.map((p) => ({
    periodStart: p.periodStart,
    periodEnd: p.periodEnd,
    paidAt: p.paidAt,
  }));

  // 1. Compute payment status
  const status = getPaymentStatus(user, paymentRecords, today);

  // 2. Compute days remaining in grace period
  let daysRemaining: number | null = null;
  if (status === "GRACE_PERIOD") {
    const gracePeriodStart = getGracePeriodStart(user, today);
    const gracePeriodLength = getGracePeriodLength(user);
    const daysIntoPeriod = getDaysBetween(gracePeriodStart, today);
    daysRemaining = Math.max(0, gracePeriodLength - daysIntoPeriod);
  }

  // 3. Latest payment (payments are pre-sorted desc by paidAt)
  const latestPayment = payments[0] || null;

  // 4. Furthest coverage: payment with the latest periodEnd
  const furthestCoverage =
    payments.length > 0
      ? payments.reduce((latest, p) =>
          p.periodEnd.getTime() > latest.periodEnd.getTime() ? p : latest
        )
      : null;

  // 5. Recent payments: last 6 months
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const recentPayments: SerializedPayment[] = payments
    .filter((p) => p.paidAt.getTime() >= sixMonthsAgo.getTime())
    .map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      paidAt: p.paidAt.toISOString(),
      periodStart: p.periodStart.toISOString(),
      periodEnd: p.periodEnd.toISOString(),
    }));

  // 6. Next payment due: day after furthest coverage ends (only if in the future)
  const nextPaymentDueDate = furthestCoverage
    ? addDays(furthestCoverage.periodEnd, 1)
    : null;
  const nextPaymentDue =
    nextPaymentDueDate && nextPaymentDueDate.getTime() >= today.getTime()
      ? nextPaymentDueDate.toISOString()
      : null;

  return {
    status,
    daysRemaining,
    lastPaymentDate: latestPayment?.paidAt.toISOString() || null,
    paidThroughDate: furthestCoverage?.periodEnd.toISOString() || null,
    nextPaymentDue,
    recentPayments,
    totalPaymentCount: payments.length,
  };
}
