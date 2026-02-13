/**
 * Session Schema Validation Tests
 *
 * Tests SessionCreateSchema (recurring) and OneOffSessionCreateSchema (one-off).
 */

import { describe, it, expect } from "vitest";
import {
  SessionCreateSchema,
  OneOffSessionCreateSchema,
} from "@/types";

describe("SessionCreateSchema (recurring mode)", () => {
  it("accepts valid recurring session input", () => {
    const result = SessionCreateSchema.safeParse({
      recurringSlotId: "cm1234567890abcdef",
      weekDate: "2025-03-10",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing weekDate", () => {
    const result = SessionCreateSchema.safeParse({
      recurringSlotId: "cm1234567890abcdef",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid recurringSlotId format", () => {
    const result = SessionCreateSchema.safeParse({
      recurringSlotId: "not-a-cuid",
      weekDate: "2025-03-10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid weekDate format", () => {
    const result = SessionCreateSchema.safeParse({
      recurringSlotId: "cm1234567890abcdef",
      weekDate: "not-a-date",
    });
    expect(result.success).toBe(false);
  });
});

describe("OneOffSessionCreateSchema", () => {
  it("accepts valid one-off session input", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      customDay: 3,
      customStartHour: 14,
      weekDate: "2025-03-10",
    });
    expect(result.success).toBe(true);
  });

  it("rejects customDay < 1", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      customDay: 0,
      customStartHour: 14,
      weekDate: "2025-03-10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects customDay > 7", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      customDay: 8,
      customStartHour: 14,
      weekDate: "2025-03-10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects customStartHour < 7", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      customDay: 1,
      customStartHour: 6,
      weekDate: "2025-03-10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects customStartHour > 22", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      customDay: 1,
      customStartHour: 23,
      weekDate: "2025-03-10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing customDay", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      customStartHour: 14,
      weekDate: "2025-03-10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing customStartHour", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      customDay: 3,
      weekDate: "2025-03-10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer customDay", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      customDay: 1.5,
      customStartHour: 14,
      weekDate: "2025-03-10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer customStartHour", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      customDay: 1,
      customStartHour: 9.5,
      weekDate: "2025-03-10",
    });
    expect(result.success).toBe(false);
  });

  it("accepts boundary values customDay=1, customStartHour=7", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      customDay: 1,
      customStartHour: 7,
      weekDate: "2025-03-10",
    });
    expect(result.success).toBe(true);
  });

  it("accepts boundary values customDay=7, customStartHour=22", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      customDay: 7,
      customStartHour: 22,
      weekDate: "2025-03-10",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing weekDate", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      customDay: 3,
      customStartHour: 14,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid weekDate format", () => {
    const result = OneOffSessionCreateSchema.safeParse({
      customDay: 3,
      customStartHour: 14,
      weekDate: "not-a-date",
    });
    expect(result.success).toBe(false);
  });
});
