/**
 * Strict Schema Validation Tests
 *
 * Verifies that all Zod schemas reject unexpected/extra fields.
 * OWASP: Prevents mass assignment attacks (parameter pollution).
 */

import { describe, it, expect } from "vitest";
import {
  RegisterSchema,
  PaymentSchema,
  VoteSchema,
  SessionCreateSchema,
  OneOffSessionCreateSchema,
  MemberUpdateSchema,
  PrivateSessionSchema,
  RecurringSlotSchema,
  SessionTrainerAssignmentSchema,
  SessionMemberAssignmentSchema,
  WorkoutSchema,
  DepartureSchema,
  PromoteMemberSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  NotificationCreateSchema,
  AnalyticsQuerySchema,
  PaymentsQuerySchema,
  DateRangeQuerySchema,
  NotificationsQuerySchema,
} from "@/types";

describe("Strict schema validation — rejects unexpected fields", () => {
  it("RegisterSchema rejects extra fields", () => {
    const result = RegisterSchema.safeParse({
      email: "test@test.com",
      password: "Test1234!",
      name: "Test",
      phone: "123",
      isAdmin: true,
    });
    expect(result.success).toBe(false);
  });

  it("LoginSchema rejects extra fields", () => {
    const result = LoginSchema.safeParse({
      email: "test@test.com",
      password: "Test1234!",
      rememberMe: true,
    });
    expect(result.success).toBe(false);
  });

  it("ForgotPasswordSchema rejects extra fields", () => {
    const result = ForgotPasswordSchema.safeParse({
      email: "test@test.com",
      admin: true,
    });
    expect(result.success).toBe(false);
  });

  it("ResetPasswordSchema rejects extra fields", () => {
    const result = ResetPasswordSchema.safeParse({
      token: "abc123",
      password: "Test1234!",
      userId: "inject",
    });
    expect(result.success).toBe(false);
  });

  it("PaymentSchema rejects extra fields", () => {
    const result = PaymentSchema.safeParse({
      userId: "cm1234567890abcdef",
      amount: 100,
      paidAt: "2026-01-01T00:00:00.000Z",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      notes: "ok",
      role: "OWNER",
    });
    expect(result.success).toBe(false);
  });

  it("VoteSchema rejects extra fields", () => {
    const result = VoteSchema.safeParse({
      sessionId: "cm1234567890abcdef",
      attending: true,
      force: true,
    });
    expect(result.success).toBe(false);
  });

  it("SessionCreateSchema rejects extra fields", () => {
    const result = SessionCreateSchema.safeParse({
      recurringSlotId: "cm1234567890abcdef",
      weekDate: "2026-01-01",
      status: "CANCELLED",
    });
    expect(result.success).toBe(false);
  });

  it("OneOffSessionCreateSchema rejects extra fields", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      customDay: 1,
      customStartHour: 9,
      weekDate: "2026-01-01",
      ownerId: "admin",
    });
    expect(result.success).toBe(false);
  });

  it("MemberUpdateSchema rejects extra fields", () => {
    const result = MemberUpdateSchema.safeParse({
      name: "Updated",
      role: "OWNER",
    });
    expect(result.success).toBe(false);
  });

  it("PrivateSessionSchema rejects extra fields", () => {
    const result = PrivateSessionSchema.safeParse({
      clientName: "Jane",
      scheduledAt: "2026-01-01T09:00:00.000Z",
      paid: false,
      id: "inject-id",
    });
    expect(result.success).toBe(false);
  });

  it("RecurringSlotSchema rejects extra fields", () => {
    const result = RecurringSlotSchema.safeParse({
      dayOfWeek: 1,
      startHour: 9,
      ownerId: "admin",
    });
    expect(result.success).toBe(false);
  });

  it("SessionTrainerAssignmentSchema rejects extra fields", () => {
    const result = SessionTrainerAssignmentSchema.safeParse({
      userId: "cm1234567890abcdef",
      action: "add",
      role: "OWNER",
    });
    expect(result.success).toBe(false);
  });

  it("SessionMemberAssignmentSchema rejects extra fields", () => {
    const result = SessionMemberAssignmentSchema.safeParse({
      userId: "cm1234567890abcdef",
      action: "add",
      isAdmin: true,
    });
    expect(result.success).toBe(false);
  });

  it("WorkoutSchema rejects extra fields", () => {
    const result = WorkoutSchema.safeParse({
      title: "Workout",
      details: "Details",
      secret: "x",
    });
    expect(result.success).toBe(false);
  });

  it("DepartureSchema rejects extra fields", () => {
    const result = DepartureSchema.safeParse({
      reason: "Moving away",
      forceDelete: true,
    });
    expect(result.success).toBe(false);
  });

  it("PromoteMemberSchema rejects extra fields", () => {
    const result = PromoteMemberSchema.safeParse({
      memberId: "cm1234567890abcdef",
      role: "OWNER",
    });
    expect(result.success).toBe(false);
  });

  it("NotificationCreateSchema rejects extra fields", () => {
    const result = NotificationCreateSchema.safeParse({
      userId: "cm1234567890abcdef",
      type: "WORKOUT_POSTED",
      title: "Test",
      body: "Test body",
      admin: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("String length limits — rejects oversized fields", () => {
  it("RegisterSchema rejects email > 254 chars", () => {
    const longEmail = "a".repeat(246) + "@test.com"; // 255 chars, exceeds 254 limit
    const result = RegisterSchema.safeParse({
      email: longEmail,
      password: "Test1234!",
      name: "Test",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailErrors = result.error.flatten().fieldErrors.email;
      expect(emailErrors).toBeDefined();
    }
  });

  it("RegisterSchema rejects password > 128 chars", () => {
    const longPassword = "Aa1!" + "x".repeat(125); // 129 chars
    const result = RegisterSchema.safeParse({
      email: "test@test.com",
      password: longPassword,
      name: "Test",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const pwErrors = result.error.flatten().fieldErrors.password;
      expect(pwErrors).toBeDefined();
    }
  });

  it("RegisterSchema rejects name > 100 chars", () => {
    const longName = "A".repeat(101);
    const result = RegisterSchema.safeParse({
      email: "test@test.com",
      password: "Test1234!",
      name: longName,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameErrors = result.error.flatten().fieldErrors.name;
      expect(nameErrors).toBeDefined();
    }
  });

  it("PaymentSchema rejects notes > 500 chars", () => {
    const longNotes = "x".repeat(501);
    const result = PaymentSchema.safeParse({
      userId: "cm1234567890abcdef",
      amount: 100,
      paidAt: "2026-01-01T00:00:00.000Z",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      notes: longNotes,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const notesErrors = result.error.flatten().fieldErrors.notes;
      expect(notesErrors).toBeDefined();
    }
  });

  it("PrivateSessionSchema rejects clientName > 100 chars", () => {
    const longName = "C".repeat(101);
    const result = PrivateSessionSchema.safeParse({
      clientName: longName,
      scheduledAt: "2026-01-01T09:00:00.000Z",
      paid: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameErrors = result.error.flatten().fieldErrors.clientName;
      expect(nameErrors).toBeDefined();
    }
  });

  it("NotificationCreateSchema rejects title > 200 chars", () => {
    const longTitle = "T".repeat(201);
    const result = NotificationCreateSchema.safeParse({
      userId: "cm1234567890abcdef",
      type: "WORKOUT_POSTED",
      title: longTitle,
      body: "Test body",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const titleErrors = result.error.flatten().fieldErrors.title;
      expect(titleErrors).toBeDefined();
    }
  });

  it("NotificationCreateSchema rejects body > 2000 chars", () => {
    const longBody = "B".repeat(2001);
    const result = NotificationCreateSchema.safeParse({
      userId: "cm1234567890abcdef",
      type: "WORKOUT_POSTED",
      title: "Test",
      body: longBody,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const bodyErrors = result.error.flatten().fieldErrors.body;
      expect(bodyErrors).toBeDefined();
    }
  });

  it("PromoteMemberSchema rejects invalid memberId", () => {
    const result = PromoteMemberSchema.safeParse({
      memberId: "not-a-cuid",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const memberIdErrors = result.error.flatten().fieldErrors.memberId;
      expect(memberIdErrors).toBeDefined();
    }
  });

  it("LoginSchema rejects email > 254 chars", () => {
    const longEmail = "a".repeat(246) + "@test.com"; // 255 chars, exceeds 254 limit
    const result = LoginSchema.safeParse({
      email: longEmail,
      password: "Test1234!",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailErrors = result.error.flatten().fieldErrors.email;
      expect(emailErrors).toBeDefined();
    }
  });

  it("LoginSchema rejects password > 128 chars", () => {
    const longPassword = "x".repeat(129);
    const result = LoginSchema.safeParse({
      email: "test@test.com",
      password: longPassword,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const pwErrors = result.error.flatten().fieldErrors.password;
      expect(pwErrors).toBeDefined();
    }
  });
});

describe("Query parameter schemas — AnalyticsQuerySchema", () => {
  it("requires both startDate and endDate", () => {
    const onlyStart = AnalyticsQuerySchema.safeParse({ startDate: "2026-01-01" });
    expect(onlyStart.success).toBe(false);

    const onlyEnd = AnalyticsQuerySchema.safeParse({ endDate: "2026-01-31" });
    expect(onlyEnd.success).toBe(false);

    const neither = AnalyticsQuerySchema.safeParse({});
    expect(neither.success).toBe(false);
  });

  it("rejects startDate after endDate", () => {
    const result = AnalyticsQuerySchema.safeParse({
      startDate: "2026-03-01",
      endDate: "2026-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid YYYY-MM-DD dates", () => {
    const result = AnalyticsQuerySchema.safeParse({
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-date strings", () => {
    const result = AnalyticsQuerySchema.safeParse({
      startDate: "not-a-date",
      endDate: "also-not",
    });
    expect(result.success).toBe(false);
  });

  it("rejects extra query params (.strict())", () => {
    const result = AnalyticsQuerySchema.safeParse({
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      page: 1,
    });
    expect(result.success).toBe(false);
  });
});

describe("Query parameter schemas — PaymentsQuerySchema", () => {
  it("accepts all fields optional", () => {
    const result = PaymentsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects startDate after endDate", () => {
    const result = PaymentsQuerySchema.safeParse({
      startDate: "2026-06-01",
      endDate: "2026-01-01",
    });
    expect(result.success).toBe(false);
  });

  it("rejects extra query params", () => {
    const result = PaymentsQuerySchema.safeParse({
      userId: "cm1234567890abcdef",
      admin: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("Query parameter schemas — DateRangeQuerySchema", () => {
  it("accepts no params (both optional)", () => {
    const result = DateRangeQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("validates date format", () => {
    const valid = DateRangeQuerySchema.safeParse({
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });
    expect(valid.success).toBe(true);

    const invalid = DateRangeQuerySchema.safeParse({
      startDate: "01/01/2026",
    });
    expect(invalid.success).toBe(false);
  });
});

describe("Query parameter schemas — NotificationsQuerySchema", () => {
  it("accepts unread=true/false", () => {
    const trueResult = NotificationsQuerySchema.safeParse({ unread: "true" });
    expect(trueResult.success).toBe(true);

    const falseResult = NotificationsQuerySchema.safeParse({ unread: "false" });
    expect(falseResult.success).toBe(true);
  });

  it("rejects unread=yes", () => {
    const result = NotificationsQuerySchema.safeParse({ unread: "yes" });
    expect(result.success).toBe(false);
  });

  it("coerces limit to number", () => {
    const result = NotificationsQuerySchema.safeParse({ limit: "50" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
      expect(typeof result.data.limit).toBe("number");
    }
  });

  it("rejects limit > 100", () => {
    const result = NotificationsQuerySchema.safeParse({ limit: "101" });
    expect(result.success).toBe(false);
  });

  it("rejects limit < 1", () => {
    const result = NotificationsQuerySchema.safeParse({ limit: "0" });
    expect(result.success).toBe(false);
  });

  it("rejects extra params", () => {
    const result = NotificationsQuerySchema.safeParse({
      unread: "true",
      page: "1",
    });
    expect(result.success).toBe(false);
  });
});

describe("Valid data still passes — positive validation tests", () => {
  it("RegisterSchema accepts valid data with all fields", () => {
    const result = RegisterSchema.safeParse({
      email: "user@example.com",
      password: "SecureP@ss1",
      name: "Jane Doe",
      phone: "+389 70 123 456",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
      expect(result.data.name).toBe("Jane Doe");
      expect(result.data.phone).toBe("+389 70 123 456");
    }
  });

  it("RegisterSchema accepts valid data without optional phone", () => {
    const result = RegisterSchema.safeParse({
      email: "user@example.com",
      password: "SecureP@ss1",
      name: "Jane Doe",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBeUndefined();
    }
  });

  it("PaymentSchema accepts valid data", () => {
    const result = PaymentSchema.safeParse({
      userId: "cm1234567890abcdef",
      amount: 2500,
      paidAt: "2026-02-15T10:30:00.000Z",
      periodStart: "2026-02-01",
      periodEnd: "2026-02-28",
      notes: "Paid in cash",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(2500);
      expect(result.data.notes).toBe("Paid in cash");
    }
  });

  it("VoteSchema accepts valid data", () => {
    const result = VoteSchema.safeParse({
      sessionId: "cm1234567890abcdef",
      attending: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.attending).toBe(true);
    }
  });

  it("PrivateSessionSchema accepts valid data with all fields", () => {
    const result = PrivateSessionSchema.safeParse({
      clientName: "Maria Petrova",
      scheduledAt: "2026-03-01T14:00:00.000Z",
      paid: true,
      amount: 1500,
      exerciseDetails: "Upper body strength training",
      notes: "First session — assess fitness level",
      trainerId: "cm1234567890abcdef",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.clientName).toBe("Maria Petrova");
      expect(result.data.paid).toBe(true);
      expect(result.data.amount).toBe(1500);
    }
  });

  it("PrivateSessionSchema accepts valid data with only required fields", () => {
    const result = PrivateSessionSchema.safeParse({
      clientName: "Ana",
      scheduledAt: "2026-03-01T14:00:00.000Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.paid).toBe(false); // default
      expect(result.data.amount).toBeUndefined();
      expect(result.data.exerciseDetails).toBeUndefined();
      expect(result.data.notes).toBeUndefined();
      expect(result.data.trainerId).toBeUndefined();
    }
  });
});

describe("PaymentSchema — periodStart/periodEnd refine validation", () => {
  const validPayment = {
    userId: "cm1234567890abcdef",
    amount: 2500,
    paidAt: "2026-02-15T10:30:00.000Z",
    periodStart: "2026-02-01",
    periodEnd: "2026-02-28",
  };

  it("rejects periodStart after periodEnd", () => {
    const result = PaymentSchema.safeParse({
      ...validPayment,
      periodStart: "2026-03-01",
      periodEnd: "2026-02-01",
    });
    expect(result.success).toBe(false);
  });

  it("accepts periodStart equal to periodEnd", () => {
    const result = PaymentSchema.safeParse({
      ...validPayment,
      periodStart: "2026-02-15",
      periodEnd: "2026-02-15",
    });
    expect(result.success).toBe(true);
  });

  it("accepts periodStart before periodEnd", () => {
    const result = PaymentSchema.safeParse({
      ...validPayment,
      periodStart: "2026-02-01",
      periodEnd: "2026-02-28",
    });
    expect(result.success).toBe(true);
  });

  it("refine error has path ['periodEnd']", () => {
    const result = PaymentSchema.safeParse({
      ...validPayment,
      periodStart: "2026-03-01",
      periodEnd: "2026-02-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const periodEndErrors = result.error.issues.filter(
        (issue) => issue.path.length === 1 && issue.path[0] === "periodEnd"
      );
      expect(periodEndErrors.length).toBeGreaterThan(0);
    }
  });

  it("refine error has message 'periodStart must not be after periodEnd'", () => {
    const result = PaymentSchema.safeParse({
      ...validPayment,
      periodStart: "2026-03-01",
      periodEnd: "2026-02-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain("periodStart must not be after periodEnd");
    }
  });

  it("still validates other fields before reaching refine", () => {
    const result = PaymentSchema.safeParse({
      ...validPayment,
      amount: -100,
      periodStart: "2026-03-01",
      periodEnd: "2026-02-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const amountErrors = result.error.flatten().fieldErrors.amount;
      expect(amountErrors).toBeDefined();
    }
  });

  it("accepts valid payment with no notes (optional field)", () => {
    const result = PaymentSchema.safeParse(validPayment);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).toBeUndefined();
    }
  });

  it("rejects when periodStart is much later than periodEnd", () => {
    const result = PaymentSchema.safeParse({
      ...validPayment,
      periodStart: "2027-01-01",
      periodEnd: "2026-01-01",
    });
    expect(result.success).toBe(false);
  });
});

describe("OneOffSessionCreateSchema — hour boundary validation", () => {
  const validOneOff = {
    customDay: 1,
    customStartHour: 9,
    weekDate: "2026-01-05",
  };

  it("rejects customStartHour below SLOT_START_HOUR (6)", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      ...validOneOff,
      customStartHour: 6,
    });
    expect(result.success).toBe(false);
  });

  it("accepts customStartHour at SLOT_START_HOUR boundary (7)", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      ...validOneOff,
      customStartHour: 7,
    });
    expect(result.success).toBe(true);
  });

  it("accepts customStartHour at SLOT_END_HOUR boundary (22)", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      ...validOneOff,
      customStartHour: 22,
    });
    expect(result.success).toBe(true);
  });

  it("rejects customStartHour above SLOT_END_HOUR (23)", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      ...validOneOff,
      customStartHour: 23,
    });
    expect(result.success).toBe(false);
  });

  it("rejects customStartHour of 0 (midnight)", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      ...validOneOff,
      customStartHour: 0,
    });
    expect(result.success).toBe(false);
  });

  it("accepts customStartHour in middle range (14)", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      ...validOneOff,
      customStartHour: 14,
    });
    expect(result.success).toBe(true);
  });
});

describe("RecurringSlotSchema — hour boundary validation", () => {
  const validSlot = {
    dayOfWeek: 1,
    startHour: 9,
  };

  it("rejects startHour below SLOT_START_HOUR (6)", () => {
    const result = RecurringSlotSchema.safeParse({
      ...validSlot,
      startHour: 6,
    });
    expect(result.success).toBe(false);
  });

  it("accepts startHour at SLOT_START_HOUR boundary (7)", () => {
    const result = RecurringSlotSchema.safeParse({
      ...validSlot,
      startHour: 7,
    });
    expect(result.success).toBe(true);
  });

  it("accepts startHour at SLOT_END_HOUR boundary (22)", () => {
    const result = RecurringSlotSchema.safeParse({
      ...validSlot,
      startHour: 22,
    });
    expect(result.success).toBe(true);
  });

  it("rejects startHour above SLOT_END_HOUR (23)", () => {
    const result = RecurringSlotSchema.safeParse({
      ...validSlot,
      startHour: 23,
    });
    expect(result.success).toBe(false);
  });

  it("rejects startHour of 0 (midnight)", () => {
    const result = RecurringSlotSchema.safeParse({
      ...validSlot,
      startHour: 0,
    });
    expect(result.success).toBe(false);
  });

  it("accepts startHour in middle range (14)", () => {
    const result = RecurringSlotSchema.safeParse({
      ...validSlot,
      startHour: 14,
    });
    expect(result.success).toBe(true);
  });
});
