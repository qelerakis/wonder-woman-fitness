/**
 * Payment Status Computation
 *
 * Payment status is COMPUTED, never stored as a column on the User model.
 * This prevents stale data and ensures real-time accuracy.
 *
 * Trial period IS the grace period for new members:
 * - New members (TRIAL status): 14-day grace from registration, then LOCKED
 * - Active members: 10-day grace from 1st of month, then LOCKED
 */

import { GRACE_PERIOD_DAYS, TRIAL_DAYS } from './constants';
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
 * Resolution order:
 * 1. DEPARTED users → always DEPARTED
 * 2. Owner override active → OVERRIDE (bypasses all payment checks)
 * 3. Check for payment covering today → PAID
 * 4. No payment → calculate grace period:
 *    - Trial users: grace = TRIAL_DAYS (14), starts from registration (trialEndsAt - TRIAL_DAYS)
 *    - Active users: grace = GRACE_PERIOD_DAYS (10), starts from 1st of month
 *    - Within grace → GRACE_PERIOD
 *    - Past grace → LOCKED
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

  // 2. Owner override bypasses all payment checks (except DEPARTED)
  if (user.overrideActive) {
    return 'OVERRIDE';
  }

  // 3. Check if any payment covers today's date
  const hasCoveringPayment = payments.some((payment) => {
    const periodStart = normalizeDate(payment.periodStart);
    const periodEnd = normalizeDate(payment.periodEnd);
    const todayNormalized = normalizeDate(today);

    return todayNormalized >= periodStart && todayNormalized <= periodEnd;
  });

  if (hasCoveringPayment) {
    return 'PAID';
  }

  // 4. No covering payment — calculate grace period
  const gracePeriodStart = getGracePeriodStart(user, today);
  const gracePeriodLength = getGracePeriodLength(user);
  const daysSinceGraceStart = getDaysBetween(gracePeriodStart, today);

  if (daysSinceGraceStart <= gracePeriodLength) {
    return 'GRACE_PERIOD';
  }

  // 5. Past grace period → LOCKED
  return 'LOCKED';
}

/**
 * Get the grace period length for a user.
 * Trial members get TRIAL_DAYS (14), active members get GRACE_PERIOD_DAYS (10).
 */
export function getGracePeriodLength(user: Pick<PaymentUser, 'status'>): number {
  if (user.status === 'TRIAL') {
    return TRIAL_DAYS;
  }
  return GRACE_PERIOD_DAYS;
}

/**
 * Determine the start of the grace period.
 *
 * - For trial users: grace starts from registration date (trialEndsAt - TRIAL_DAYS)
 * - For active users: grace starts from 1st of current month
 */
function getGracePeriodStart(user: PaymentUser, today: Date): Date {
  // Trial user: grace starts from registration date
  if (user.status === 'TRIAL' && user.trialEndsAt) {
    const trialEnd = normalizeDate(user.trialEndsAt);
    return new Date(Date.UTC(
      trialEnd.getUTCFullYear(),
      trialEnd.getUTCMonth(),
      trialEnd.getUTCDate() - TRIAL_DAYS
    ));
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
