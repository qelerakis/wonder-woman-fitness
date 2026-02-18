/**
 * Payment Status Logic Tests
 *
 * Tests all payment status computation scenarios.
 * Payment status is COMPUTED, never stored.
 *
 * Key change: Trial period IS the grace period.
 * - Trial members: 14-day grace from registration, then LOCKED
 * - Active members: 10-day grace from 1st of month, then LOCKED
 */

import { describe, it, expect } from 'vitest';
import { getPaymentStatus, getGracePeriodLength } from '../payment-logic';
import type { PaymentStatus } from '../constants';

// ===== Test Helpers =====

interface TestUser {
  id: string;
  status: 'TRIAL' | 'ACTIVE' | 'DEPARTED';
  trialEndsAt: Date | null;
  departedAt: Date | null;
  overrideActive: boolean;
}

interface TestPayment {
  periodStart: Date;
  periodEnd: Date;
  paidAt: Date;
}

function makeUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    id: 'test-user-1',
    status: 'ACTIVE',
    trialEndsAt: null,
    departedAt: null,
    overrideActive: false,
    ...overrides,
  };
}

function makePayment(periodStart: string, periodEnd: string, paidAt?: string): TestPayment {
  return {
    periodStart: new Date(periodStart),
    periodEnd: new Date(periodEnd),
    paidAt: new Date(paidAt || periodStart),
  };
}

function date(str: string): Date {
  return new Date(str);
}

// ===== Tests =====

describe('getPaymentStatus', () => {
  // Scenario 1: Departed user → DEPARTED
  describe('departed users', () => {
    it('returns DEPARTED when user status is DEPARTED', () => {
      const user = makeUser({
        status: 'DEPARTED',
        departedAt: date('2025-06-15'),
      });

      const result = getPaymentStatus(user, [], date('2025-07-01'));

      expect(result).toBe('DEPARTED' satisfies PaymentStatus);
    });

    it('returns DEPARTED regardless of existing payments', () => {
      const user = makeUser({
        status: 'DEPARTED',
        departedAt: date('2025-06-15'),
      });
      const payments = [makePayment('2025-06-01', '2025-06-30')];

      const result = getPaymentStatus(user, payments, date('2025-06-20'));

      expect(result).toBe('DEPARTED' satisfies PaymentStatus);
    });
  });

  // Scenario 2: Trial members — trial IS the grace period (14 days)
  describe('trial members (trial = grace period)', () => {
    it('returns GRACE_PERIOD on day 1 of trial (registration day)', () => {
      // Registered July 1, trial ends July 15
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2025-07-15'),
      });

      const result = getPaymentStatus(user, [], date('2025-07-01'));

      expect(result).toBe('GRACE_PERIOD' satisfies PaymentStatus);
    });

    it('returns GRACE_PERIOD on day 7 of trial', () => {
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2025-07-15'),
      });

      const result = getPaymentStatus(user, [], date('2025-07-07'));

      expect(result).toBe('GRACE_PERIOD' satisfies PaymentStatus);
    });

    it('returns GRACE_PERIOD on last day of trial (day 14)', () => {
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2025-07-15'),
      });

      const result = getPaymentStatus(user, [], date('2025-07-14'));

      expect(result).toBe('GRACE_PERIOD' satisfies PaymentStatus);
    });

    it('returns LOCKED on the day after trial ends (day 15)', () => {
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2025-07-15'),
      });

      const result = getPaymentStatus(user, [], date('2025-07-15'));

      expect(result).toBe('LOCKED' satisfies PaymentStatus);
    });

    it('returns LOCKED well after trial ends', () => {
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2025-07-15'),
      });

      const result = getPaymentStatus(user, [], date('2025-08-01'));

      expect(result).toBe('LOCKED' satisfies PaymentStatus);
    });

    it('returns PAID when trial member has a covering payment', () => {
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2025-07-15'),
      });
      const payments = [makePayment('2025-07-01', '2025-07-31')];

      const result = getPaymentStatus(user, payments, date('2025-07-10'));

      expect(result).toBe('PAID' satisfies PaymentStatus);
    });

    it('returns PAID when payment recorded during trial', () => {
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2025-07-15'),
      });
      const payments = [makePayment('2025-07-01', '2025-07-31', '2025-07-05')];

      const result = getPaymentStatus(user, payments, date('2025-07-05'));

      expect(result).toBe('PAID' satisfies PaymentStatus);
    });
  });

  // Scenario 3: Active member, paid for current month → PAID
  describe('active members - paid', () => {
    it('returns PAID when payment covers current month', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [makePayment('2025-07-01', '2025-07-31')];

      const result = getPaymentStatus(user, payments, date('2025-07-15'));

      expect(result).toBe('PAID' satisfies PaymentStatus);
    });

    it('returns PAID on the first day of paid period', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [makePayment('2025-07-01', '2025-07-31')];

      const result = getPaymentStatus(user, payments, date('2025-07-01'));

      expect(result).toBe('PAID' satisfies PaymentStatus);
    });

    it('returns PAID on the last day of paid period', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [makePayment('2025-07-01', '2025-07-31')];

      const result = getPaymentStatus(user, payments, date('2025-07-31'));

      expect(result).toBe('PAID' satisfies PaymentStatus);
    });
  });

  // Scenario 4: Active member, no payment, day 1-10 of month → GRACE_PERIOD
  describe('active members - grace period', () => {
    it('returns GRACE_PERIOD on day 1 of unpaid month', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments: TestPayment[] = [];

      const result = getPaymentStatus(user, payments, date('2025-07-01'));

      expect(result).toBe('GRACE_PERIOD' satisfies PaymentStatus);
    });

    it('returns GRACE_PERIOD on day 10 of unpaid month', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments: TestPayment[] = [];

      const result = getPaymentStatus(user, payments, date('2025-07-10'));

      expect(result).toBe('GRACE_PERIOD' satisfies PaymentStatus);
    });

    it('returns GRACE_PERIOD when previous month was paid but current is not', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [makePayment('2025-06-01', '2025-06-30')];

      const result = getPaymentStatus(user, payments, date('2025-07-05'));

      expect(result).toBe('GRACE_PERIOD' satisfies PaymentStatus);
    });
  });

  // Scenario 5: Active member, no payment, day 11+ → LOCKED
  describe('active members - locked', () => {
    it('returns LOCKED on day 11 of unpaid month', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments: TestPayment[] = [];

      const result = getPaymentStatus(user, payments, date('2025-07-11'));

      expect(result).toBe('LOCKED' satisfies PaymentStatus);
    });

    it('returns LOCKED on day 25 of unpaid month', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments: TestPayment[] = [];

      const result = getPaymentStatus(user, payments, date('2025-07-25'));

      expect(result).toBe('LOCKED' satisfies PaymentStatus);
    });
  });

  // Scenario 6: Advance payment covering future months → PAID
  describe('advance payments', () => {
    it('returns PAID when advance payment covers current month', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [makePayment('2025-07-01', '2025-09-30', '2025-07-01')];

      const result = getPaymentStatus(user, payments, date('2025-08-15'));

      expect(result).toBe('PAID' satisfies PaymentStatus);
    });

    it('returns PAID for the last month of advance payment', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [makePayment('2025-07-01', '2025-09-30', '2025-07-01')];

      const result = getPaymentStatus(user, payments, date('2025-09-15'));

      expect(result).toBe('PAID' satisfies PaymentStatus);
    });

    it('returns GRACE_PERIOD after advance payment period ends', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [makePayment('2025-07-01', '2025-09-30', '2025-07-01')];

      const result = getPaymentStatus(user, payments, date('2025-10-05'));

      expect(result).toBe('GRACE_PERIOD' satisfies PaymentStatus);
    });
  });

  // Scenario 7: Owner override active → OVERRIDE
  describe('owner override', () => {
    it('returns OVERRIDE when override is active even with no payment', () => {
      const user = makeUser({
        status: 'ACTIVE',
        overrideActive: true,
      });

      const result = getPaymentStatus(user, [], date('2025-07-25'));

      expect(result).toBe('OVERRIDE' satisfies PaymentStatus);
    });

    it('returns OVERRIDE even when normally would be LOCKED', () => {
      const user = makeUser({
        status: 'ACTIVE',
        overrideActive: true,
      });

      const result = getPaymentStatus(user, [], date('2025-07-15'));

      expect(result).toBe('OVERRIDE' satisfies PaymentStatus);
    });

    it('returns OVERRIDE for trial user with override', () => {
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2025-06-15'),
        overrideActive: true,
      });

      const result = getPaymentStatus(user, [], date('2025-07-01'));

      expect(result).toBe('OVERRIDE' satisfies PaymentStatus);
    });
  });

  // Scenario 8: Payment recorded during grace period → immediate PAID
  describe('payment recorded during grace period', () => {
    it('returns PAID when payment recorded on day 10', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [makePayment('2025-07-01', '2025-07-31', '2025-07-10')];

      const result = getPaymentStatus(user, payments, date('2025-07-10'));

      expect(result).toBe('PAID' satisfies PaymentStatus);
    });

    it('returns PAID immediately after payment, even if recorded late', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [makePayment('2025-07-01', '2025-07-31', '2025-07-12')];

      const result = getPaymentStatus(user, payments, date('2025-07-12'));

      expect(result).toBe('PAID' satisfies PaymentStatus);
    });
  });

  // Edge cases
  describe('edge cases', () => {
    it('handles multiple payments — uses most recent covering payment', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [
        makePayment('2025-06-01', '2025-06-30'),
        makePayment('2025-07-01', '2025-07-31'),
      ];

      const result = getPaymentStatus(user, payments, date('2025-07-15'));

      expect(result).toBe('PAID' satisfies PaymentStatus);
    });

    it('returns DEPARTED even when override is active', () => {
      const user = makeUser({
        status: 'DEPARTED',
        departedAt: date('2025-06-15'),
        overrideActive: true,
      });

      const result = getPaymentStatus(user, [], date('2025-07-01'));

      expect(result).toBe('DEPARTED' satisfies PaymentStatus);
    });

    it('handles year boundary correctly', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [makePayment('2025-12-01', '2025-12-31')];

      const result = getPaymentStatus(user, payments, date('2026-01-05'));

      expect(result).toBe('GRACE_PERIOD' satisfies PaymentStatus);
    });

    it('handles year boundary — locked after grace period', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [makePayment('2025-12-01', '2025-12-31')];

      const result = getPaymentStatus(user, payments, date('2026-01-12'));

      expect(result).toBe('LOCKED' satisfies PaymentStatus);
    });

    it('handles TRIAL user with null trialEndsAt (defensive)', () => {
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: null,
      });

      // Falls through to active-style grace (1st of month)
      const result = getPaymentStatus(user, [], date('2025-07-05'));

      expect(result).toBe('GRACE_PERIOD' satisfies PaymentStatus);
    });

    it('handles TRIAL user with null trialEndsAt — locked after day 10', () => {
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: null,
      });

      const result = getPaymentStatus(user, [], date('2025-07-15'));

      expect(result).toBe('LOCKED' satisfies PaymentStatus);
    });
  });

  // ===== Trial boundary edge cases (trial-is-grace-period feature) =====
  describe('trial boundary edge cases', () => {
    it('returns GRACE_PERIOD on exact registration day (day 1 of 14)', () => {
      // Registered Jan 10, trial ends Jan 24 (14 days)
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2025-01-24'),
      });

      // Day 1 = Jan 10 (registration day)
      const result = getPaymentStatus(user, [], date('2025-01-10'));

      expect(result).toBe('GRACE_PERIOD' satisfies PaymentStatus);
    });

    it('returns GRACE_PERIOD on day 13 (one day before last)', () => {
      // Registered Jan 10, trial ends Jan 24
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2025-01-24'),
      });

      // Day 13 = Jan 22
      const result = getPaymentStatus(user, [], date('2025-01-22'));

      expect(result).toBe('GRACE_PERIOD' satisfies PaymentStatus);
    });

    it('returns LOCKED on trialEndsAt date itself (day after 14-day window)', () => {
      // Registered Jan 10, trial ends Jan 24
      // Day 15 = Jan 24 = trialEndsAt
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2025-01-24'),
      });

      const result = getPaymentStatus(user, [], date('2025-01-24'));

      expect(result).toBe('LOCKED' satisfies PaymentStatus);
    });

    it('handles month boundary: registered Jan 30, trialEndsAt Feb 13', () => {
      // Registered Jan 30, 14-day trial ends Feb 13
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2025-02-13'),
      });

      // Feb 1 — day 3 of trial → GRACE_PERIOD
      expect(getPaymentStatus(user, [], date('2025-02-01'))).toBe('GRACE_PERIOD' satisfies PaymentStatus);
      // Feb 12 — day 14 (last day of grace) → GRACE_PERIOD
      expect(getPaymentStatus(user, [], date('2025-02-12'))).toBe('GRACE_PERIOD' satisfies PaymentStatus);
      // Feb 13 — trialEndsAt (day 15) → LOCKED
      expect(getPaymentStatus(user, [], date('2025-02-13'))).toBe('LOCKED' satisfies PaymentStatus);
    });

    it('returns GRACE_PERIOD for trial member with payment starting AFTER trial period', () => {
      // Registered Jan 10, trial ends Jan 24
      // Payment covers Feb 1 - Feb 28 (does NOT cover today Jan 15)
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2025-01-24'),
      });
      const payments = [makePayment('2025-02-01', '2025-02-28')];

      const result = getPaymentStatus(user, payments, date('2025-01-15'));

      expect(result).toBe('GRACE_PERIOD' satisfies PaymentStatus);
    });

    it('returns PAID for trial member with payment covering trial period', () => {
      // Registered Jan 10, trial ends Jan 24
      // Payment covers Jan 1 - Jan 31 (covers today Jan 15)
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2025-01-24'),
      });
      const payments = [makePayment('2025-01-01', '2025-01-31')];

      const result = getPaymentStatus(user, payments, date('2025-01-15'));

      expect(result).toBe('PAID' satisfies PaymentStatus);
    });

    it('returns OVERRIDE for trial member with override DURING trial', () => {
      // During the 14-day trial, override still wins
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2025-01-24'),
        overrideActive: true,
      });

      const result = getPaymentStatus(user, [], date('2025-01-15'));

      expect(result).toBe('OVERRIDE' satisfies PaymentStatus);
    });

    it('returns OVERRIDE for trial member with override AFTER trial expired', () => {
      // After the 14-day trial, override still wins (would be LOCKED otherwise)
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2025-01-24'),
        overrideActive: true,
      });

      const result = getPaymentStatus(user, [], date('2025-02-15'));

      expect(result).toBe('OVERRIDE' satisfies PaymentStatus);
    });

    it('active member (previously TRIAL) uses 10-day grace from 1st of month', () => {
      // Member was TRIAL, owner transitioned to ACTIVE
      // Now uses the standard active-member grace period (10 days from 1st)
      const user = makeUser({
        status: 'ACTIVE',
        trialEndsAt: date('2025-01-24'), // leftover from trial; status is ACTIVE now
      });

      // Day 5 of month (no payment) → GRACE_PERIOD (10-day active grace)
      expect(getPaymentStatus(user, [], date('2025-02-05'))).toBe('GRACE_PERIOD' satisfies PaymentStatus);
      // Day 10 of month → still GRACE_PERIOD (boundary)
      expect(getPaymentStatus(user, [], date('2025-02-10'))).toBe('GRACE_PERIOD' satisfies PaymentStatus);
      // Day 11 of month → LOCKED (past 10-day active grace)
      expect(getPaymentStatus(user, [], date('2025-02-11'))).toBe('LOCKED' satisfies PaymentStatus);
    });

    it('trial grace period is exactly 14 days, not 13 or 15', () => {
      // Registered Mar 1, trial ends Mar 15
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2025-03-15'),
      });

      // Day 14 = Mar 14 → GRACE_PERIOD (last day)
      expect(getPaymentStatus(user, [], date('2025-03-14'))).toBe('GRACE_PERIOD' satisfies PaymentStatus);
      // Day 15 = Mar 15 = trialEndsAt → LOCKED (one past 14)
      expect(getPaymentStatus(user, [], date('2025-03-15'))).toBe('LOCKED' satisfies PaymentStatus);
    });

    it('active grace period is exactly 10 days, not 9 or 11', () => {
      const user = makeUser({ status: 'ACTIVE' });

      // Day 10 of month → GRACE_PERIOD (last day of grace)
      expect(getPaymentStatus(user, [], date('2025-03-10'))).toBe('GRACE_PERIOD' satisfies PaymentStatus);
      // Day 11 of month → LOCKED (one past 10)
      expect(getPaymentStatus(user, [], date('2025-03-11'))).toBe('LOCKED' satisfies PaymentStatus);
    });

    it('returns DEPARTED for departed trial user even during trial window', () => {
      // User was in trial but departed mid-trial
      const user = makeUser({
        status: 'DEPARTED',
        trialEndsAt: date('2025-01-24'),
        departedAt: date('2025-01-15'),
      });

      const result = getPaymentStatus(user, [], date('2025-01-18'));

      expect(result).toBe('DEPARTED' satisfies PaymentStatus);
    });

    it('returns PAID for trial member when payment starts on registration day', () => {
      // Member registered Jan 10, paid immediately for Jan
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2025-01-24'),
      });
      const payments = [makePayment('2025-01-10', '2025-01-31', '2025-01-10')];

      const result = getPaymentStatus(user, payments, date('2025-01-10'));

      expect(result).toBe('PAID' satisfies PaymentStatus);
    });

    it('trial member with no payment on day right before trialEndsAt → GRACE_PERIOD', () => {
      // Registered Feb 1, trialEndsAt Feb 15
      // Day 14 = Feb 14 → last day of grace
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2025-02-15'),
      });

      const result = getPaymentStatus(user, [], date('2025-02-14'));

      expect(result).toBe('GRACE_PERIOD' satisfies PaymentStatus);
    });

    it('trial member locked months after trial expired (no status transition)', () => {
      // If the cron never transitions status to ACTIVE, TRIAL stays
      // They should still be LOCKED well past trialEndsAt
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2025-01-15'),
      });

      const result = getPaymentStatus(user, [], date('2025-06-01'));

      expect(result).toBe('LOCKED' satisfies PaymentStatus);
    });
  });
});

describe('getGracePeriodLength', () => {
  it('returns TRIAL_DAYS (14) for trial users', () => {
    expect(getGracePeriodLength({ status: 'TRIAL' })).toBe(14);
  });

  it('returns GRACE_PERIOD_DAYS (10) for active users', () => {
    expect(getGracePeriodLength({ status: 'ACTIVE' })).toBe(10);
  });

  it('returns GRACE_PERIOD_DAYS (10) for departed users', () => {
    expect(getGracePeriodLength({ status: 'DEPARTED' })).toBe(10);
  });

  it('returns exactly 14, not 13 or 15, for TRIAL', () => {
    const result = getGracePeriodLength({ status: 'TRIAL' });
    expect(result).toBe(14);
    expect(result).not.toBe(13);
    expect(result).not.toBe(15);
  });

  it('returns exactly 10, not 9 or 11, for ACTIVE', () => {
    const result = getGracePeriodLength({ status: 'ACTIVE' });
    expect(result).toBe(10);
    expect(result).not.toBe(9);
    expect(result).not.toBe(11);
  });
});
