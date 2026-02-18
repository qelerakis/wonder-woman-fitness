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
  TrainerCreateSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  NotificationCreateSchema,
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

  it("TrainerCreateSchema rejects extra fields", () => {
    const result = TrainerCreateSchema.safeParse({
      email: "t@test.com",
      name: "Trainer",
      phone: "123",
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
