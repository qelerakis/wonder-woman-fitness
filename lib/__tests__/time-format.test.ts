/**
 * Time Format Unit Tests
 *
 * Comprehensive tests for the 24-hour time formatting functions:
 * - formatTime (from SessionCard) — formats hour to "HH:00"
 * - formatHour (from AttendanceChart) — formats hour to "HH:00"
 *
 * Verifies that the 12-hour AM/PM format has been fully removed
 * and all outputs use consistent 24-hour "HH:00" format.
 */

import { describe, it, expect } from "vitest";
import { formatTime } from "@/components/schedule/SessionCard";
import { formatHour } from "@/components/analytics/AttendanceChart";

describe("formatTime (SessionCard)", () => {
  // ─── Boundary Values ──────────────────────────────────────────────

  it("formats hour 0 (midnight) as 00:00", () => {
    expect(formatTime(0)).toBe("00:00");
  });

  it("formats hour 1 as 01:00", () => {
    expect(formatTime(1)).toBe("01:00");
  });

  it("formats hour 9 (single digit) as 09:00 with zero-padding", () => {
    expect(formatTime(9)).toBe("09:00");
  });

  it("formats hour 10 (double digit) as 10:00", () => {
    expect(formatTime(10)).toBe("10:00");
  });

  it("formats hour 12 (noon, the AM/PM pivot) as 12:00", () => {
    expect(formatTime(12)).toBe("12:00");
  });

  it("formats hour 13 (first PM hour in old format) as 13:00", () => {
    expect(formatTime(13)).toBe("13:00");
  });

  it("formats hour 23 (last valid hour) as 23:00", () => {
    expect(formatTime(23)).toBe("23:00");
  });

  // ─── Exhaustive 0-23 Range ────────────────────────────────────────

  it("produces exactly HH:00 format for all hours 0-23", () => {
    for (let h = 0; h < 24; h++) {
      expect(formatTime(h)).toMatch(/^\d{2}:00$/);
    }
  });

  it("produces exactly 5 characters for all hours 0-23", () => {
    for (let h = 0; h < 24; h++) {
      expect(formatTime(h)).toHaveLength(5);
    }
  });

  it("never contains AM or PM for any hour 0-23", () => {
    for (let h = 0; h < 24; h++) {
      const result = formatTime(h);
      expect(result).not.toMatch(/AM/i);
      expect(result).not.toMatch(/PM/i);
    }
  });

  it("never contains a space for any hour 0-23", () => {
    for (let h = 0; h < 24; h++) {
      expect(formatTime(h)).not.toContain(" ");
    }
  });

  // ─── Specific Hour Ranges ─────────────────────────────────────────

  it("formats all single-digit hours with zero-padding", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(1)).toBe("01:00");
    expect(formatTime(2)).toBe("02:00");
    expect(formatTime(3)).toBe("03:00");
    expect(formatTime(4)).toBe("04:00");
    expect(formatTime(5)).toBe("05:00");
    expect(formatTime(6)).toBe("06:00");
    expect(formatTime(7)).toBe("07:00");
    expect(formatTime(8)).toBe("08:00");
    expect(formatTime(9)).toBe("09:00");
  });

  it("formats all double-digit hours correctly", () => {
    expect(formatTime(10)).toBe("10:00");
    expect(formatTime(11)).toBe("11:00");
    expect(formatTime(12)).toBe("12:00");
    expect(formatTime(13)).toBe("13:00");
    expect(formatTime(14)).toBe("14:00");
    expect(formatTime(15)).toBe("15:00");
    expect(formatTime(16)).toBe("16:00");
    expect(formatTime(17)).toBe("17:00");
    expect(formatTime(18)).toBe("18:00");
    expect(formatTime(19)).toBe("19:00");
    expect(formatTime(20)).toBe("20:00");
    expect(formatTime(21)).toBe("21:00");
    expect(formatTime(22)).toBe("22:00");
    expect(formatTime(23)).toBe("23:00");
  });
});

describe("formatHour (AttendanceChart)", () => {
  // ─── Boundary Values ──────────────────────────────────────────────

  it("formats hour 0 (midnight) as 00:00", () => {
    expect(formatHour(0)).toBe("00:00");
  });

  it("formats hour 1 as 01:00", () => {
    expect(formatHour(1)).toBe("01:00");
  });

  it("formats hour 9 (single digit) as 09:00 with zero-padding", () => {
    expect(formatHour(9)).toBe("09:00");
  });

  it("formats hour 10 (double digit) as 10:00", () => {
    expect(formatHour(10)).toBe("10:00");
  });

  it("formats hour 12 (noon, the AM/PM pivot) as 12:00", () => {
    expect(formatHour(12)).toBe("12:00");
  });

  it("formats hour 13 (first PM hour in old format) as 13:00", () => {
    expect(formatHour(13)).toBe("13:00");
  });

  it("formats hour 23 (last valid hour) as 23:00", () => {
    expect(formatHour(23)).toBe("23:00");
  });

  // ─── Exhaustive 0-23 Range ────────────────────────────────────────

  it("produces exactly HH:00 format for all hours 0-23", () => {
    for (let h = 0; h < 24; h++) {
      expect(formatHour(h)).toMatch(/^\d{2}:00$/);
    }
  });

  it("produces exactly 5 characters for all hours 0-23", () => {
    for (let h = 0; h < 24; h++) {
      expect(formatHour(h)).toHaveLength(5);
    }
  });

  it("never contains AM or PM for any hour 0-23", () => {
    for (let h = 0; h < 24; h++) {
      const result = formatHour(h);
      expect(result).not.toMatch(/AM/i);
      expect(result).not.toMatch(/PM/i);
    }
  });

  it("never contains a space for any hour 0-23", () => {
    for (let h = 0; h < 24; h++) {
      expect(formatHour(h)).not.toContain(" ");
    }
  });
});

describe("formatTime and formatHour consistency", () => {
  it("both functions produce identical output for all hours 0-23", () => {
    for (let h = 0; h < 24; h++) {
      expect(formatTime(h)).toBe(formatHour(h));
    }
  });
});
