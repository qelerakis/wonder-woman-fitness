/**
 * Payment Status Computation
 *
 * Payment status is COMPUTED, never stored as a column on the User model.
 * This prevents stale data and ensures real-time accuracy.
 *
 * See ARCHITECTURE.md section 4.2 for the full status resolution algorithm.
 */

import { GRACE_PERIOD_DAYS } from './constants';
import type { PaymentStatus } from './constants';

/**
 * Minimal user shape required for payment status computation.
 * Avoids coupling to the full Prisma User type.
 */
export interface PaymentUser {
  id: string;
  status: 'TRIAL' | 'ACTIVE' | 'DEPARTED';
  trialEndsAt: Date | null;
  departedAt: Date | null;
  overrideActive: boolean;
}

/**
 * Minimal payment shape required for payment status computation.
 */
export interface PaymentRecord {
  periodStart: Date;
  periodEnd: Date;
  paidAt: Date;
}

/**
 * Compute the current payment status for a user.
 *
 * Resolution order (deviation from ARCHITECTURE.md section 4.2 — see note):
 * 1. DEPARTED users → always DEPARTED
 * 2. TRIAL users before trialEndsAt → TRIAL
 * 3. Owner override active → OVERRIDE (bypasses payment checks)
 * 4. Check for payment covering today → PAID
 * 5. No payment → calculate grace period:
 *    - For trial-expired users: grace starts from trialEndsAt
 *    - For active users: grace starts from 1st of current month
 *    - Days 1-10 → GRACE_PERIOD
 *    - Day 11+ → LOCKED
 *
 * NOTE: ARCHITECTURE.md places the override at step 6 (after payment check).
 * We intentionally check override at step 3 because an override is an owner
 * action that should bypass ALL payment logic. If a user has both an override
 * and a valid payment, reporting OVERRIDE is more accurate (the owner explicitly
 * intervened). When the override is removed, the status correctly falls through
 * to PAID or GRACE_PERIOD based on actual payment records.
 *
 * @param user - User with status, trialEndsAt, overrideActive
 * @param payments - Array of payment records with periodStart/periodEnd
 * @param today - Current date (injectable for testing)
 * @returns Computed PaymentStatus
 */
export function getPaymentStatus(
  user: PaymentUser,
  payments: PaymentRecord[],
  today: Date
): PaymentStatus {
  // 1. Departed users are always DEPARTED, regardless of anything else
  if (user.status === 'DEPARTED') {
    return 'DEPARTED';
  }

  // 2. Trial members still within their trial period
  if (user.status === 'TRIAL' && user.trialEndsAt) {
    if (today < user.trialEndsAt) {
      return 'TRIAL';
    }
  }

  // 3. Owner override bypasses all payment checks (except DEPARTED)
  if (user.overrideActive) {
    return 'OVERRIDE';
  }

  // 4. Check if any payment covers today's date
  const hasCoveringPayment = payments.some((payment) => {
    const periodStart = normalizeDate(payment.periodStart);
    const periodEnd = normalizeDate(payment.periodEnd);
    const todayNormalized = normalizeDate(today);

    return todayNormalized >= periodStart && todayNormalized <= periodEnd;
  });

  if (hasCoveringPayment) {
    return 'PAID';
  }

  // 5. No covering payment — calculate grace period
  const gracePeriodStart = getGracePeriodStart(user, today);
  const daysSinceGraceStart = getDaysBetween(gracePeriodStart, today);

  if (daysSinceGraceStart <= GRACE_PERIOD_DAYS) {
    return 'GRACE_PERIOD';
  }

  // 6. Past grace period → LOCKED
  return 'LOCKED';
}

/**
 * Determine the start of the grace period.
 *
 * - For trial-expired users: grace starts from trialEndsAt
 * - For active users: grace starts from 1st of current month
 */
function getGracePeriodStart(user: PaymentUser, today: Date): Date {
  // Trial-expired user: grace period starts from trial end date
  if (user.status === 'TRIAL' && user.trialEndsAt) {
    return normalizeDate(user.trialEndsAt);
  }

  // Active user: grace period starts from 1st of current month
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
}

/**
 * Calculate the number of days between two dates (inclusive of start day).
 * Day 1 is the start date itself.
 */
function getDaysBetween(start: Date, end: Date): number {
  const startNorm = normalizeDate(start);
  const endNorm = normalizeDate(end);
  const diffMs = endNorm.getTime() - startNorm.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  // Day 1 = the start date, so add 1
  return diffDays + 1;
}

/**
 * Normalize a date to UTC midnight for consistent comparisons.
 * Uses UTC methods to avoid timezone-dependent drift on non-UTC servers.
 */
function normalizeDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
