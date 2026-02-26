/**
 * date-locale.test.ts — getDateLocale utility tests
 *
 * Verifies the locale helper returns the correct date-fns locale
 * for each supported application locale.
 */

import { describe, it, expect } from "vitest";
import { getDateLocale } from "@/lib/date-locale";
import { mk, enUS } from "date-fns/locale";
import { format } from "date-fns";

describe("getDateLocale", () => {
  it("returns Macedonian locale for 'mk'", () => {
    expect(getDateLocale("mk")).toBe(mk);
  });

  it("returns English (US) locale for 'en'", () => {
    expect(getDateLocale("en")).toBe(enUS);
  });

  it("returns English (US) locale for unknown locale strings", () => {
    expect(getDateLocale("fr")).toBe(enUS);
    expect(getDateLocale("de")).toBe(enUS);
    expect(getDateLocale("")).toBe(enUS);
  });

  it("produces different day names for mk vs en locales", () => {
    // Wednesday Feb 25 2026
    const date = new Date(2026, 1, 25);
    const enDay = format(date, "EEEE", { locale: getDateLocale("en") });
    const mkDay = format(date, "EEEE", { locale: getDateLocale("mk") });
    expect(enDay).toBe("Wednesday");
    expect(mkDay).not.toBe("Wednesday");
    // Macedonian for Wednesday is "среда"
    expect(mkDay.length).toBeGreaterThan(0);
  });

  it("produces different month names for mk vs en locales", () => {
    const date = new Date(2026, 1, 1); // February
    const enMonth = format(date, "MMMM", { locale: getDateLocale("en") });
    const mkMonth = format(date, "MMMM", { locale: getDateLocale("mk") });
    expect(enMonth).toBe("February");
    expect(mkMonth).not.toBe("February");
  });

  it("formats a full date differently for each locale", () => {
    const date = new Date(2026, 2, 9, 9, 0); // March 9, 2026 9:00 AM
    const enFormatted = format(date, "EEE, MMM d, h:mm a", { locale: getDateLocale("en") });
    const mkFormatted = format(date, "EEE, MMM d, h:mm a", { locale: getDateLocale("mk") });
    expect(enFormatted).toContain("Mon");
    expect(mkFormatted).not.toContain("Mon");
  });
});
