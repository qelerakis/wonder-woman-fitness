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
});
