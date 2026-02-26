/**
 * next-intl-mock.test.ts — Verifies the vitest mock for next-intl
 *
 * Tests that useTranslations, useLocale, getTranslations, getLocale,
 * and getMessages work correctly with the English translation file,
 * including namespace resolution, ICU plurals, and placeholder interpolation.
 */

import { describe, it, expect } from "vitest";
import { useTranslations, useLocale } from "next-intl";
import { getTranslations, getLocale, getMessages } from "next-intl/server";
import en from "@/messages/en.json";

describe("next-intl mock — useTranslations", () => {
  it("returns a function", () => {
    const t = useTranslations("common");
    expect(typeof t).toBe("function");
  });

  it("resolves known keys from the common namespace", () => {
    const t = useTranslations("common");
    expect(t("save")).toBe("Save");
    expect(t("cancel")).toBe("Cancel");
    expect(t("loading")).toBe("Loading...");
  });

  it("returns fallback key path for unknown keys", () => {
    const t = useTranslations("common");
    expect(t("nonExistentKey")).toBe("common.nonExistentKey");
  });

  it("resolves keys from the schedule namespace", () => {
    const t = useTranslations("schedule");
    expect(t("title")).toBe("Schedule");
    expect(t("dayMonday")).toBe("Monday");
    expect(t("statusScheduled")).toBe("Scheduled");
    expect(t("statusCancelled")).toBe("Cancelled");
  });

  it("resolves keys from the attendance namespace", () => {
    const t = useTranslations("attendance");
    expect(t("title")).toBe("Attendance");
    expect(t("addMember")).toBe("+ Add Member");
    expect(t("cancelAdd")).toBe("Cancel");
  });

  it("resolves keys from the workout namespace", () => {
    const t = useTranslations("workout");
    expect(t("editWorkout")).toBe("Edit Workout");
    expect(t("saveWorkout")).toBe("Save Workout");
    expect(t("titleRequired")).toBe("Workout title is required");
  });

  it("resolves keys from the deleteSlot namespace", () => {
    const t = useTranslations("deleteSlot");
    expect(t("failedToDelete")).toBe("Failed to delete recurring slot");
    expect(t("networkError")).toBe("Network error. Please try again.");
  });

  it("resolves keys from the memberTable namespace", () => {
    const t = useTranslations("memberTable");
    expect(t("searchPlaceholder")).toBe("Search by name or email...");
    expect(t("allStatuses")).toBe("All Statuses");
    expect(t("noMembersYet")).toBe("No members yet");
  });

  it("interpolates simple placeholders", () => {
    const t = useTranslations("schedule");
    expect(t("byDeadline", { deadline: "Mon 9 AM" })).toBe("by Mon 9 AM");
  });

  it("interpolates multiple placeholders", () => {
    const t = useTranslations("schedule");
    expect(t("votingClosesIn", { hours: 3, minutes: 45 })).toBe("Closes in 3h 45m");
  });

  it("handles ICU plural — singular", () => {
    const t = useTranslations("paymentBanner");
    const result = t("daysRemaining", { count: 1 });
    expect(result).toContain("1 day");
    expect(result).not.toContain("days");
  });

  it("handles ICU plural — plural", () => {
    const t = useTranslations("paymentBanner");
    const result = t("daysRemaining", { count: 5 });
    expect(result).toContain("5 days");
  });

  it("resolves keys from the payments namespace", () => {
    const t = useTranslations("payments");
    expect(t("paymentUpdated")).toBe("Payment updated");
    expect(t("paymentDeleted")).toBe("Payment deleted");
  });
});

describe("next-intl mock — useLocale", () => {
  it("returns 'en' as the default test locale", () => {
    expect(useLocale()).toBe("en");
  });
});

describe("next-intl mock — server functions", () => {
  it("getTranslations returns a translation function", async () => {
    const t = await getTranslations("common");
    expect(typeof t).toBe("function");
    expect(t("save")).toBe("Save");
  });

  it("getLocale returns 'en'", async () => {
    const locale = await getLocale();
    expect(locale).toBe("en");
  });

  it("getMessages returns the full en.json messages object", async () => {
    const messages = await getMessages();
    expect(messages).toEqual(en);
  });
});
