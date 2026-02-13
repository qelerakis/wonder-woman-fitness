/**
 * Payment Status Logic Tests
 *
 * Tests all payment status computation scenarios per ARCHITECTURE.md section 4.2.
 * Payment status is COMPUTED, never stored.
 */

import { describe, it, expect } from 'vitest';
import { getPaymentStatus } from '../payment-logic';
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

  // Scenario 2: Trial member, before trialEndsAt → TRIAL
  describe('trial members', () => {
    it('returns TRIAL when user is in trial and trial has not expired', () => {
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2025-07-15'),
      });

      const result = getPaymentStatus(user, [], date('2025-07-10'));

      expect(result).toBe('TRIAL' satisfies PaymentStatus);
    });

    it('returns TRIAL on the last day of trial', () => {
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2025-07-15'),
      });

      // Still TRIAL on the day itself (before the date)
      const result = getPaymentStatus(user, [], date('2025-07-14'));

      expect(result).toBe('TRIAL' satisfies PaymentStatus);
    });
  });

  // Scenario 3: Trial expired, no payment, day 1-10 from trialEndsAt → GRACE_PERIOD
  describe('trial expired - grace period', () => {
    it('returns GRACE_PERIOD on day 1 after trial expires', () => {
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2025-07-15'),
      });

      const result = getPaymentStatus(user, [], date('2025-07-15'));

      expect(result).toBe('GRACE_PERIOD' satisfies PaymentStatus);
    });

    it('returns GRACE_PERIOD on day 10 after trial expires', () => {
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2025-07-15'),
      });

      // 10 days after trialEndsAt = July 25
      const result = getPaymentStatus(user, [], date('2025-07-24'));

      expect(result).toBe('GRACE_PERIOD' satisfies PaymentStatus);
    });
  });

  // Scenario 4: Trial expired, no payment, day 11+ from trialEndsAt → LOCKED
  describe('trial expired - locked', () => {
    it('returns LOCKED when trial expired more than 10 days ago with no payment', () => {
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2025-07-15'),
      });

      // 11 days after trialEndsAt = July 26
      const result = getPaymentStatus(user, [], date('2025-07-26'));

      expect(result).toBe('LOCKED' satisfies PaymentStatus);
    });
  });

  // Scenario 5: Active member, paid for current month → PAID
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

  // Scenario 6: Active member, no payment, day 1-10 of month → GRACE_PERIOD
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

  // Scenario 7: Active member, no payment, day 11+ → LOCKED
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

  // Scenario 8: Advance payment covering future months → PAID
  describe('advance payments', () => {
    it('returns PAID when advance payment covers current month', () => {
      const user = makeUser({ status: 'ACTIVE' });
      // Payment covers July through September
      const payments = [makePayment('2025-07-01', '2025-09-30', '2025-07-01')];

      const result = getPaymentStatus(user, payments, date('2025-08-15'));

      expect(result).toBe('PAID' satisfies PaymentStatus);
    });

    it('returns PAID for the last month of advance payment', () => {
      const user = makeUser({ status: 'ACTIVE' });
      // Payment covers July through September
      const payments = [makePayment('2025-07-01', '2025-09-30', '2025-07-01')];

      const result = getPaymentStatus(user, payments, date('2025-09-15'));

      expect(result).toBe('PAID' satisfies PaymentStatus);
    });

    it('returns GRACE_PERIOD after advance payment period ends', () => {
      const user = makeUser({ status: 'ACTIVE' });
      // Payment covers July through September
      const payments = [makePayment('2025-07-01', '2025-09-30', '2025-07-01')];

      const result = getPaymentStatus(user, payments, date('2025-10-05'));

      expect(result).toBe('GRACE_PERIOD' satisfies PaymentStatus);
    });
  });

  // Scenario 9: Owner override active → OVERRIDE
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
  });

  // Scenario 10: Payment recorded on day 10 → immediate PAID
  describe('payment recorded during grace period', () => {
    it('returns PAID when payment recorded on day 10', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [makePayment('2025-07-01', '2025-07-31', '2025-07-10')];

      const result = getPaymentStatus(user, payments, date('2025-07-10'));

      expect(result).toBe('PAID' satisfies PaymentStatus);
    });

    it('returns PAID immediately after payment, even if recorded late', () => {
      const user = makeUser({ status: 'ACTIVE' });
      // Payment covers July, recorded on July 12 (would have been locked)
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

    it('handles trial user with override as OVERRIDE', () => {
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: date('2025-06-15'),
        overrideActive: true,
      });

      // Trial expired, but override is active
      const result = getPaymentStatus(user, [], date('2025-07-01'));

      expect(result).toBe('OVERRIDE' satisfies PaymentStatus);
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

      // January of next year — no payment, should be grace period early
      const result = getPaymentStatus(user, payments, date('2026-01-05'));

      expect(result).toBe('GRACE_PERIOD' satisfies PaymentStatus);
    });

    it('handles year boundary — locked after grace period', () => {
      const user = makeUser({ status: 'ACTIVE' });
      const payments = [makePayment('2025-12-01', '2025-12-31')];

      // January 12 — past grace period
      const result = getPaymentStatus(user, payments, date('2026-01-12'));

      expect(result).toBe('LOCKED' satisfies PaymentStatus);
    });

    it('handles TRIAL user with null trialEndsAt (defensive)', () => {
      // This should be an impossible state in practice (registration always sets trialEndsAt),
      // but we test defensively: if trialEndsAt is null, the TRIAL check is skipped
      // and the user falls through to payment/grace logic
      const user = makeUser({
        status: 'TRIAL',
        trialEndsAt: null,
      });

      // No payment, day 5 of month → GRACE_PERIOD (treated like ACTIVE)
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
