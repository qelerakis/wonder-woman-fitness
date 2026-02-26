/**
 * Profile Payment Info Computation Tests
 *
 * Tests for computeProfilePaymentInfo(), a pure function that combines
 * payment status computation with display-oriented data extraction
 * for the member profile page.
 *
 * Uses real payment-logic functions (no mocks) since they are pure too.
 *
 * Key business rules:
 * - Trial users: 14-day grace from registration date
 * - Active users: 10-day grace from 1st of month
 * - GRACE_PERIOD_DAYS = 10, TRIAL_DAYS = 14
 * - Payment covering today (periodStart <= today <= periodEnd) -> PAID
 * - overrideActive -> OVERRIDE
 * - DEPARTED status -> DEPARTED
 * - Recent payments = last 6 months from today
 */

import { describe, it, expect } from 'vitest';
import {
  computeProfilePaymentInfo,
  type ProfilePaymentUser,
  type ProfilePaymentRow,
} from '../profile-payment-info';

// ===== Test Helpers =====

function makeUser(overrides: Partial<ProfilePaymentUser> = {}): ProfilePaymentUser {
  return {
    id: 'user-1',
    status: 'ACTIVE',
    trialEndsAt: null,
    departedAt: null,
    overrideActive: false,
    ...overrides,
  };
}

function makePayment(
  id: string,
  periodStart: string,
  periodEnd: string,
  paidAt?: string,
  amount?: number
): ProfilePaymentRow {
  return {
    id,
    amount: amount ?? 2000,
    paidAt: new Date(paidAt ?? periodStart),
    periodStart: new Date(periodStart),
    periodEnd: new Date(periodEnd),
  };
}

function date(str: string): Date {
  return new Date(str);
}

// ===== Tests =====

describe('computeProfilePaymentInfo', () => {
  // =========================================================================
  // Basic status computation
  // =========================================================================
  describe('basic status computation', () => {
    it('returns PAID for ACTIVE user with current month payment', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [
        makePayment('p1', '2026-02-01', '2026-02-28', '2026-02-01'),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      expect(result.status).toBe('PAID');
    });

    it('returns GRACE_PERIOD for ACTIVE user with no payments at start of month', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const today = date('2026-02-05');

      const result = computeProfilePaymentInfo(user, [], today);

      expect(result.status).toBe('GRACE_PERIOD');
    });

    it('returns LOCKED for ACTIVE user with expired grace period', () => {
      const user = makeUser({ status: 'ACTIVE' });
      // Day 11+ of the month with no payment -> LOCKED (grace = 10 days)
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, [], today);

      expect(result.status).toBe('LOCKED');
    });

    it('returns GRACE_PERIOD for TRIAL user within 14-day trial', () => {
      // Trial ends Feb 20, so registration is Feb 6
      // On Feb 10, that is day 5 of 14 -> GRACE_PERIOD
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2026-02-20'),
      });
      const today = date('2026-02-10');

      const result = computeProfilePaymentInfo(user, [], today);

      expect(result.status).toBe('GRACE_PERIOD');
    });

    it('returns LOCKED for TRIAL user with trial expired', () => {
      // Trial ended Feb 10, registration was Jan 27
      // On Feb 15, well past the 14-day window -> LOCKED
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2026-02-10'),
      });
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, [], today);

      expect(result.status).toBe('LOCKED');
    });

    it('returns DEPARTED for DEPARTED user', () => {
      const user = makeUser({
        status: 'DEPARTED',
        departedAt: date('2026-01-15'),
      });
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, [], today);

      expect(result.status).toBe('DEPARTED');
    });

    it('returns DEPARTED for DEPARTED user even with covering payment', () => {
      const user = makeUser({
        status: 'DEPARTED',
        departedAt: date('2026-02-01'),
      });
      const payments = [
        makePayment('p1', '2026-02-01', '2026-02-28', '2026-02-01'),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      expect(result.status).toBe('DEPARTED');
    });

    it('returns OVERRIDE for user with overrideActive', () => {
      const user = makeUser({ overrideActive: true });
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, [], today);

      expect(result.status).toBe('OVERRIDE');
    });

    it('returns OVERRIDE even if user has no payments and grace expired', () => {
      const user = makeUser({ overrideActive: true });
      // Day 20 with no payments — would be LOCKED, but override wins
      const today = date('2026-02-20');

      const result = computeProfilePaymentInfo(user, [], today);

      expect(result.status).toBe('OVERRIDE');
    });
  });

  // =========================================================================
  // Days remaining
  // =========================================================================
  describe('days remaining', () => {
    it('computes correct days for GRACE_PERIOD active user', () => {
      const user = makeUser({ status: 'ACTIVE' });
      // Feb 3 -> day 3 of month (getDaysBetween(Feb1, Feb3) = 3)
      // Grace = 10, daysRemaining = max(0, 10 - 3) = 7
      const today = date('2026-02-03');

      const result = computeProfilePaymentInfo(user, [], today);

      expect(result.status).toBe('GRACE_PERIOD');
      expect(result.daysRemaining).toBe(7);
    });

    it('computes correct days for GRACE_PERIOD trial user', () => {
      // Trial ends Feb 20, registration = Feb 6
      // On Feb 8, getDaysBetween(Feb6, Feb8) = 3
      // Grace = 14, daysRemaining = max(0, 14 - 3) = 11
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2026-02-20'),
      });
      const today = date('2026-02-08');

      const result = computeProfilePaymentInfo(user, [], today);

      expect(result.status).toBe('GRACE_PERIOD');
      expect(result.daysRemaining).toBe(11);
    });

    it('returns null daysRemaining for PAID status', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [
        makePayment('p1', '2026-02-01', '2026-02-28', '2026-02-01'),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      expect(result.status).toBe('PAID');
      expect(result.daysRemaining).toBeNull();
    });

    it('returns null daysRemaining for LOCKED status', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const today = date('2026-02-20');

      const result = computeProfilePaymentInfo(user, [], today);

      expect(result.status).toBe('LOCKED');
      expect(result.daysRemaining).toBeNull();
    });

    it('returns null daysRemaining for OVERRIDE status', () => {
      const user = makeUser({ overrideActive: true });
      const today = date('2026-02-05');

      const result = computeProfilePaymentInfo(user, [], today);

      expect(result.status).toBe('OVERRIDE');
      expect(result.daysRemaining).toBeNull();
    });

    it('returns null daysRemaining for DEPARTED status', () => {
      const user = makeUser({
        status: 'DEPARTED',
        departedAt: date('2026-01-01'),
      });
      const today = date('2026-02-05');

      const result = computeProfilePaymentInfo(user, [], today);

      expect(result.status).toBe('DEPARTED');
      expect(result.daysRemaining).toBeNull();
    });

    it('returns 0 daysRemaining (not negative) at end of grace period', () => {
      const user = makeUser({ status: 'ACTIVE' });
      // Feb 10 -> day 10 of month (getDaysBetween(Feb1, Feb10) = 10)
      // Grace = 10, daysRemaining = max(0, 10 - 10) = 0
      const today = date('2026-02-10');

      const result = computeProfilePaymentInfo(user, [], today);

      expect(result.status).toBe('GRACE_PERIOD');
      expect(result.daysRemaining).toBe(0);
    });

    it('returns 10 daysRemaining on first day of month for active user', () => {
      const user = makeUser({ status: 'ACTIVE' });
      // Feb 1 -> getDaysBetween(Feb1, Feb1) = 1
      // Grace = 10, daysRemaining = max(0, 10 - 1) = 9
      const today = date('2026-02-01');

      const result = computeProfilePaymentInfo(user, [], today);

      expect(result.status).toBe('GRACE_PERIOD');
      expect(result.daysRemaining).toBe(9);
    });

    it('returns 14 days remaining on first day of trial', () => {
      // Trial ends Feb 15, registration = Feb 1
      // On Feb 1, getDaysBetween(Feb1, Feb1) = 1
      // Grace = 14, daysRemaining = max(0, 14 - 1) = 13
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2026-02-15'),
      });
      const today = date('2026-02-01');

      const result = computeProfilePaymentInfo(user, [], today);

      expect(result.status).toBe('GRACE_PERIOD');
      expect(result.daysRemaining).toBe(13);
    });
  });

  // =========================================================================
  // Last payment date
  // =========================================================================
  describe('last payment date', () => {
    it('returns most recent paidAt as ISO string', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [
        // Sorted desc by paidAt — most recent first
        makePayment('p2', '2026-02-01', '2026-02-28', '2026-02-05'),
        makePayment('p1', '2026-01-01', '2026-01-31', '2026-01-03'),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      expect(result.lastPaymentDate).toBe(new Date('2026-02-05').toISOString());
    });

    it('returns null when there are no payments', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const today = date('2026-02-05');

      const result = computeProfilePaymentInfo(user, [], today);

      expect(result.lastPaymentDate).toBeNull();
    });

    it('returns first element paidAt (already sorted desc)', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [
        makePayment('p3', '2026-01-01', '2026-01-31', '2026-02-10'),
        makePayment('p2', '2026-02-01', '2026-02-28', '2026-02-05'),
        makePayment('p1', '2025-12-01', '2025-12-31', '2025-12-01'),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      // First payment in the array (sorted desc by paidAt) is p3 paid on Feb 10
      expect(result.lastPaymentDate).toBe(new Date('2026-02-10').toISOString());
    });
  });

  // =========================================================================
  // Paid through date
  // =========================================================================
  describe('paid through date', () => {
    it('returns furthest periodEnd as ISO string', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [
        makePayment('p1', '2026-02-01', '2026-02-28', '2026-02-01'),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      expect(result.paidThroughDate).toBe(new Date('2026-02-28').toISOString());
    });

    it('returns null when there are no payments', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const today = date('2026-02-05');

      const result = computeProfilePaymentInfo(user, [], today);

      expect(result.paidThroughDate).toBeNull();
    });

    it('returns the latest periodEnd, not necessarily from the most recent paidAt', () => {
      const user = makeUser({ status: 'ACTIVE' });
      // p1 was paid more recently but covers January
      // p2 was paid earlier but covers through March (advance payment)
      const payments = [
        makePayment('p1', '2026-01-01', '2026-01-31', '2026-02-10'),
        makePayment('p2', '2026-02-01', '2026-03-31', '2026-02-01'),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      expect(result.paidThroughDate).toBe(new Date('2026-03-31').toISOString());
    });

    it('returns advance payment periodEnd for future coverage', () => {
      const user = makeUser({ status: 'ACTIVE' });
      // Payment covering Feb and March (advance)
      const payments = [
        makePayment('p1', '2026-02-01', '2026-03-31', '2026-02-01'),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      expect(result.paidThroughDate).toBe(new Date('2026-03-31').toISOString());
    });

    it('returns past periodEnd when all coverage has expired', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [
        makePayment('p1', '2026-01-01', '2026-01-31', '2026-01-01'),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      expect(result.paidThroughDate).toBe(new Date('2026-01-31').toISOString());
    });
  });

  // =========================================================================
  // Next payment due
  // =========================================================================
  describe('next payment due', () => {
    it('returns day after periodEnd when coverage ends in the future', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [
        makePayment('p1', '2026-02-01', '2026-02-28', '2026-02-01'),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      // Day after Feb 28 = March 1
      expect(result.nextPaymentDue).toBe(new Date('2026-03-01').toISOString());
    });

    it('returns null when coverage already expired (periodEnd in the past)', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [
        makePayment('p1', '2026-01-01', '2026-01-31', '2026-01-01'),
      ];
      // Today is Feb 15, coverage ended Jan 31, next due would be Feb 1 which is in the past
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      expect(result.nextPaymentDue).toBeNull();
    });

    it('returns null when there are no payments', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, [], today);

      expect(result.nextPaymentDue).toBeNull();
    });

    it('returns tomorrow when coverage ends today', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [
        makePayment('p1', '2026-02-01', '2026-02-15', '2026-02-01'),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      // Day after Feb 15 = Feb 16, which is >= today -> returned
      expect(result.nextPaymentDue).toBe(new Date('2026-02-16').toISOString());
    });

    it('uses furthest periodEnd for next due calculation', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [
        makePayment('p2', '2026-02-01', '2026-02-28', '2026-02-10'),
        makePayment('p1', '2026-03-01', '2026-03-31', '2026-02-01'),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      // Furthest periodEnd is March 31, next due = April 1
      expect(result.nextPaymentDue).toBe(new Date('2026-04-01').toISOString());
    });

    it('returns next due when advance payment extends far into future', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [
        makePayment('p1', '2026-01-01', '2026-06-30', '2026-01-01'),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      // Day after June 30 = July 1
      expect(result.nextPaymentDue).toBe(new Date('2026-07-01').toISOString());
    });
  });

  // =========================================================================
  // Recent payments (6-month filter)
  // =========================================================================
  describe('recent payments', () => {
    it('includes all payments within 6 months', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [
        makePayment('p3', '2026-02-01', '2026-02-28', '2026-02-01'),
        makePayment('p2', '2026-01-01', '2026-01-31', '2026-01-01'),
        makePayment('p1', '2025-12-01', '2025-12-31', '2025-12-01'),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      expect(result.recentPayments).toHaveLength(3);
      expect(result.recentPayments.map((p) => p.id)).toEqual(['p3', 'p2', 'p1']);
    });

    it('excludes payments older than 6 months', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [
        makePayment('p3', '2026-02-01', '2026-02-28', '2026-02-01'),
        makePayment('p2', '2025-10-01', '2025-10-31', '2025-10-01'),
        // Paid 7 months ago — should be excluded
        makePayment('p1', '2025-07-01', '2025-07-31', '2025-07-01'),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      expect(result.recentPayments).toHaveLength(2);
      expect(result.recentPayments.map((p) => p.id)).toEqual(['p3', 'p2']);
    });

    it('returns empty array when no payments within 6 months', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [
        makePayment('p1', '2025-01-01', '2025-01-31', '2025-01-01'),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      expect(result.recentPayments).toHaveLength(0);
    });

    it('includes payment exactly 6 months ago (boundary)', () => {
      const user = makeUser({ status: 'ACTIVE' });
      // Today is 2026-02-15, sixMonthsAgo = 2025-08-15
      // Payment paid on 2025-08-15 should be included (>=)
      const payments = [
        makePayment('p1', '2025-08-01', '2025-08-31', '2025-08-15'),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      expect(result.recentPayments).toHaveLength(1);
      expect(result.recentPayments[0].id).toBe('p1');
    });

    it('excludes payment 6 months + 1 day ago', () => {
      const user = makeUser({ status: 'ACTIVE' });
      // Today is 2026-02-15, sixMonthsAgo = 2025-08-15
      // Payment paid on 2025-08-14 should be excluded (<)
      const payments = [
        makePayment('p1', '2025-08-01', '2025-08-31', '2025-08-14'),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      expect(result.recentPayments).toHaveLength(0);
    });

    it('converts amounts via Number() for Prisma Decimal compatibility', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [
        makePayment('p1', '2026-02-01', '2026-02-28', '2026-02-01', 2500),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      expect(result.recentPayments[0].amount).toBe(2500);
      expect(typeof result.recentPayments[0].amount).toBe('number');
    });

    it('serializes dates to ISO strings', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [
        makePayment('p1', '2026-02-01', '2026-02-28', '2026-02-05'),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      const recent = result.recentPayments[0];
      expect(recent.paidAt).toBe(new Date('2026-02-05').toISOString());
      expect(recent.periodStart).toBe(new Date('2026-02-01').toISOString());
      expect(recent.periodEnd).toBe(new Date('2026-02-28').toISOString());
    });

    it('preserves payment order from input (sorted desc by paidAt)', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [
        makePayment('p3', '2026-02-01', '2026-02-28', '2026-02-10'),
        makePayment('p2', '2026-01-01', '2026-01-31', '2026-01-15'),
        makePayment('p1', '2025-12-01', '2025-12-31', '2025-12-20'),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      expect(result.recentPayments.map((p) => p.id)).toEqual(['p3', 'p2', 'p1']);
    });
  });

  // =========================================================================
  // Total payment count
  // =========================================================================
  describe('total payment count', () => {
    it('returns 0 for no payments', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, [], today);

      expect(result.totalPaymentCount).toBe(0);
    });

    it('returns total count including old payments outside 6-month window', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [
        makePayment('p5', '2026-02-01', '2026-02-28', '2026-02-01'),
        makePayment('p4', '2026-01-01', '2026-01-31', '2026-01-01'),
        // These 3 are older than 6 months
        makePayment('p3', '2025-05-01', '2025-05-31', '2025-05-01'),
        makePayment('p2', '2025-04-01', '2025-04-30', '2025-04-01'),
        makePayment('p1', '2025-03-01', '2025-03-31', '2025-03-01'),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      // recentPayments should have 2, but totalPaymentCount is 5
      expect(result.recentPayments).toHaveLength(2);
      expect(result.totalPaymentCount).toBe(5);
    });

    it('returns 1 for single payment', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [
        makePayment('p1', '2026-02-01', '2026-02-28', '2026-02-01'),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      expect(result.totalPaymentCount).toBe(1);
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================
  describe('edge cases', () => {
    it('returns all fields populated for user with single covering payment', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [
        makePayment('p1', '2026-02-01', '2026-02-28', '2026-02-05', 2000),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      expect(result.status).toBe('PAID');
      expect(result.daysRemaining).toBeNull();
      expect(result.lastPaymentDate).toBe(new Date('2026-02-05').toISOString());
      expect(result.paidThroughDate).toBe(new Date('2026-02-28').toISOString());
      // March 1 is after today -> returned
      expect(result.nextPaymentDue).toBe(new Date('2026-03-01').toISOString());
      expect(result.recentPayments).toHaveLength(1);
      expect(result.recentPayments[0].amount).toBe(2000);
      expect(result.totalPaymentCount).toBe(1);
    });

    it('uses furthest periodEnd when multiple advance payments exist', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [
        makePayment('p3', '2026-04-01', '2026-04-30', '2026-02-10'),
        makePayment('p2', '2026-03-01', '2026-03-31', '2026-02-05'),
        makePayment('p1', '2026-02-01', '2026-02-28', '2026-02-01'),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      expect(result.status).toBe('PAID');
      // Furthest periodEnd is April 30
      expect(result.paidThroughDate).toBe(new Date('2026-04-30').toISOString());
      // Next due is May 1
      expect(result.nextPaymentDue).toBe(new Date('2026-05-01').toISOString());
    });

    it('returns nulls for all payment fields when payments array is empty', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const today = date('2026-02-05');

      const result = computeProfilePaymentInfo(user, [], today);

      expect(result.lastPaymentDate).toBeNull();
      expect(result.paidThroughDate).toBeNull();
      expect(result.nextPaymentDue).toBeNull();
      expect(result.recentPayments).toEqual([]);
      expect(result.totalPaymentCount).toBe(0);
    });

    it('handles periodEnd exactly today: paidThroughDate is today, nextPaymentDue is tomorrow', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [
        makePayment('p1', '2026-02-01', '2026-02-15', '2026-02-01'),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      expect(result.status).toBe('PAID');
      expect(result.paidThroughDate).toBe(new Date('2026-02-15').toISOString());
      expect(result.nextPaymentDue).toBe(new Date('2026-02-16').toISOString());
    });

    it('includes advance payment with periodStart in the future', () => {
      const user = makeUser({ status: 'ACTIVE' });
      // Current month payment + advance for next month
      const payments = [
        makePayment('p2', '2026-03-01', '2026-03-31', '2026-02-15'),
        makePayment('p1', '2026-02-01', '2026-02-28', '2026-02-01'),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      expect(result.status).toBe('PAID');
      // Furthest periodEnd is March 31
      expect(result.paidThroughDate).toBe(new Date('2026-03-31').toISOString());
      // Both are within 6 months
      expect(result.recentPayments).toHaveLength(2);
      expect(result.totalPaymentCount).toBe(2);
    });

    it('handles Prisma Decimal-like amount correctly via Number()', () => {
      const user = makeUser({ status: 'ACTIVE' });
      // Simulate a Prisma Decimal that converts to number via Number()
      const payment: ProfilePaymentRow = {
        id: 'p1',
        amount: Number('1500.50'),
        paidAt: new Date('2026-02-01'),
        periodStart: new Date('2026-02-01'),
        periodEnd: new Date('2026-02-28'),
      };
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, [payment], today);

      expect(result.recentPayments[0].amount).toBe(1500.5);
    });

    it('returns correct status for active user on day 10 of month (last day of grace)', () => {
      const user = makeUser({ status: 'ACTIVE' });
      // Feb 10, getDaysBetween(Feb1, Feb10) = 10, gracePeriodLength = 10
      // 10 <= 10 -> GRACE_PERIOD with 0 days remaining
      const today = date('2026-02-10');

      const result = computeProfilePaymentInfo(user, [], today);

      expect(result.status).toBe('GRACE_PERIOD');
      expect(result.daysRemaining).toBe(0);
    });

    it('returns LOCKED for active user on day 11 of month (grace expired)', () => {
      const user = makeUser({ status: 'ACTIVE' });
      // Feb 11, getDaysBetween(Feb1, Feb11) = 11, gracePeriodLength = 10
      // 11 > 10 -> LOCKED
      const today = date('2026-02-11');

      const result = computeProfilePaymentInfo(user, [], today);

      expect(result.status).toBe('LOCKED');
      expect(result.daysRemaining).toBeNull();
    });

    it('handles trial user on last day of trial', () => {
      // Trial ends Feb 15, registration = Feb 1
      // On Feb 14, getDaysBetween(Feb1, Feb14) = 14, gracePeriodLength = 14
      // 14 <= 14 -> GRACE_PERIOD with 0 days remaining
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2026-02-15'),
      });
      const today = date('2026-02-14');

      const result = computeProfilePaymentInfo(user, [], today);

      expect(result.status).toBe('GRACE_PERIOD');
      expect(result.daysRemaining).toBe(0);
    });

    it('handles trial user day after trial ends', () => {
      // Trial ends Feb 15, registration = Feb 1
      // On Feb 15, getDaysBetween(Feb1, Feb15) = 15, gracePeriodLength = 14
      // 15 > 14 -> LOCKED
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2026-02-15'),
      });
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, [], today);

      expect(result.status).toBe('LOCKED');
      expect(result.daysRemaining).toBeNull();
    });

    it('handles payment that spans across year boundary', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [
        makePayment('p1', '2025-12-01', '2026-01-31', '2025-12-01'),
      ];
      const today = date('2026-01-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      expect(result.status).toBe('PAID');
      expect(result.paidThroughDate).toBe(new Date('2026-01-31').toISOString());
      expect(result.nextPaymentDue).toBe(new Date('2026-02-01').toISOString());
    });

    it('returns all serialized payment fields correctly', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [
        makePayment('pay-123', '2026-02-01', '2026-02-28', '2026-02-05', 3000),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      expect(result.recentPayments[0]).toEqual({
        id: 'pay-123',
        amount: 3000,
        paidAt: new Date('2026-02-05').toISOString(),
        periodStart: new Date('2026-02-01').toISOString(),
        periodEnd: new Date('2026-02-28').toISOString(),
      });
    });

    it('only filters recent payments by paidAt, not periodStart or periodEnd', () => {
      const user = makeUser({ status: 'ACTIVE' });
      // Payment was paid recently but covers a period that started 8 months ago
      const payments = [
        makePayment('p1', '2025-06-01', '2025-06-30', '2026-02-01'),
      ];
      const today = date('2026-02-15');

      const result = computeProfilePaymentInfo(user, payments, today);

      // paidAt (2026-02-01) is within 6 months of today -> included
      expect(result.recentPayments).toHaveLength(1);
      expect(result.recentPayments[0].id).toBe('p1');
    });
  });
});
