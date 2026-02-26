/**
 * i18n-translation-keys.test.ts — Translation file completeness & consistency
 *
 * Ensures en.json and mk.json have identical key structures so that
 * switching locales never shows a missing-key fallback.
 */

import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import mk from "@/messages/mk.json";

type NestedMessages = Record<string, string | Record<string, string | Record<string, string>>>;

/** Recursively collect all key paths from a nested object */
function collectKeyPaths(obj: NestedMessages, prefix = ""): string[] {
  const paths: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null) {
      paths.push(...collectKeyPaths(value as NestedMessages, fullKey));
    } else {
      paths.push(fullKey);
    }
  }
  return paths.sort();
}

/** Collect just the top-level namespace names */
function collectNamespaces(obj: NestedMessages): string[] {
  return Object.keys(obj).sort();
}

describe("Translation key completeness", () => {
  const enKeys = collectKeyPaths(en as NestedMessages);
  const mkKeys = collectKeyPaths(mk as NestedMessages);

  it("en.json and mk.json have the same number of keys", () => {
    expect(enKeys.length).toBe(mkKeys.length);
  });

  it("en.json and mk.json have the same namespaces", () => {
    expect(collectNamespaces(en as NestedMessages)).toEqual(
      collectNamespaces(mk as NestedMessages)
    );
  });

  it("every key in en.json exists in mk.json", () => {
    const mkKeySet = new Set(mkKeys);
    const missingInMk = enKeys.filter((k) => !mkKeySet.has(k));
    expect(missingInMk).toEqual([]);
  });

  it("every key in mk.json exists in en.json", () => {
    const enKeySet = new Set(enKeys);
    const missingInEn = mkKeys.filter((k) => !enKeySet.has(k));
    expect(missingInEn).toEqual([]);
  });

  it("no translation value is an empty string in en.json", () => {
    const emptyKeys = enKeys.filter((keyPath) => {
      const parts = keyPath.split(".");
      let current: unknown = en;
      for (const part of parts) {
        current = (current as Record<string, unknown>)[part];
      }
      return current === "";
    });
    expect(emptyKeys).toEqual([]);
  });

  it("no translation value is an empty string in mk.json", () => {
    const emptyKeys = mkKeys.filter((keyPath) => {
      const parts = keyPath.split(".");
      let current: unknown = mk;
      for (const part of parts) {
        current = (current as Record<string, unknown>)[part];
      }
      return current === "";
    });
    expect(emptyKeys).toEqual([]);
  });
});

describe("Translation key structure by namespace", () => {
  const namespaces = collectNamespaces(en as NestedMessages);

  for (const ns of namespaces) {
    it(`namespace "${ns}" has the same keys in both locales`, () => {
      const enNs = (en as NestedMessages)[ns];
      const mkNs = (mk as NestedMessages)[ns];
      expect(typeof enNs).toBe("object");
      expect(typeof mkNs).toBe("object");

      const enSubKeys = Object.keys(enNs as Record<string, unknown>).sort();
      const mkSubKeys = Object.keys(mkNs as Record<string, unknown>).sort();
      expect(enSubKeys).toEqual(mkSubKeys);
    });
  }
});

describe("ICU placeholder consistency", () => {
  /**
   * Extract top-level {placeholder} variable names from an ICU message.
   * Handles ICU plural/select blocks by extracting just the variable
   * name and ignoring the nested plural forms.
   */
  function extractPlaceholders(text: string): string[] {
    const vars: string[] = [];
    let i = 0;
    while (i < text.length) {
      if (text[i] === "{") {
        // Find the variable name
        const start = i + 1;
        let end = start;
        while (end < text.length && /\w/.test(text[end])) end++;
        const varName = text.slice(start, end);
        if (!varName) { i++; continue; }

        // Check if this is an ICU expression ({var, plural, ...})
        if (text[end] === ",") {
          vars.push(varName);
          // Skip the entire ICU block by counting brace depth
          let depth = 1;
          let j = i + 1;
          while (j < text.length && depth > 0) {
            if (text[j] === "{") depth++;
            else if (text[j] === "}") depth--;
            j++;
          }
          i = j;
        } else if (text[end] === "}") {
          // Simple {placeholder}
          vars.push(varName);
          i = end + 1;
        } else {
          i++;
        }
      } else {
        i++;
      }
    }
    return [...new Set(vars)].sort();
  }

  function getLeafEntries(obj: NestedMessages, prefix = ""): Array<{ path: string; value: string }> {
    const entries: Array<{ path: string; value: string }> = [];
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "object" && value !== null) {
        entries.push(...getLeafEntries(value as NestedMessages, fullKey));
      } else if (typeof value === "string") {
        entries.push({ path: fullKey, value });
      }
    }
    return entries;
  }

  const enEntries = getLeafEntries(en as NestedMessages);
  const mkMap = new Map(
    getLeafEntries(mk as NestedMessages).map((e) => [e.path, e.value])
  );

  for (const entry of enEntries) {
    const enPlaceholders = extractPlaceholders(entry.value);
    if (enPlaceholders.length === 0) continue;

    it(`${entry.path}: placeholders match between en and mk`, () => {
      const mkValue = mkMap.get(entry.path);
      expect(mkValue).toBeDefined();
      const mkPlaceholders = extractPlaceholders(mkValue!);
      expect(mkPlaceholders).toEqual(enPlaceholders);
    });
  }
});

describe("Required namespaces exist", () => {
  const requiredNamespaces = [
    "common",
    "brand",
    "language",
    "auth",
    "validation",
    "roles",
    "navigation",
    "schedule",
    "createSession",
    "deleteSlot",
    "attendance",
    "workout",
    "sessionDetail",
    "assignment",
    "payments",
    "paymentStatus",
    "paymentBanner",
    "lockout",
    "dashboard",
    "notifications",
    "members",
    "trainers",
    "privateSessions",
    "profile",
    "departed",
    "stopTraining",
    "months",
    "dateRange",
    "datePicker",
    "analytics",
    "memberTable",
  ];

  for (const ns of requiredNamespaces) {
    it(`en.json contains the "${ns}" namespace`, () => {
      expect((en as NestedMessages)[ns]).toBeDefined();
    });

    it(`mk.json contains the "${ns}" namespace`, () => {
      expect((mk as NestedMessages)[ns]).toBeDefined();
    });
  }
});

describe("Day name translations", () => {
  const dayKeys = [
    "dayMonday",
    "dayTuesday",
    "dayWednesday",
    "dayThursday",
    "dayFriday",
    "daySaturday",
    "daySunday",
  ];

  const scheduleEn = (en as NestedMessages).schedule as Record<string, string>;
  const scheduleMk = (mk as NestedMessages).schedule as Record<string, string>;

  for (const key of dayKeys) {
    it(`schedule.${key} exists in en.json`, () => {
      expect(scheduleEn[key]).toBeDefined();
      expect(scheduleEn[key].length).toBeGreaterThan(0);
    });

    it(`schedule.${key} exists in mk.json`, () => {
      expect(scheduleMk[key]).toBeDefined();
      expect(scheduleMk[key].length).toBeGreaterThan(0);
    });

    it(`schedule.${key} differs between en and mk`, () => {
      expect(scheduleEn[key]).not.toBe(scheduleMk[key]);
    });
  }

  it("en day names match expected English values", () => {
    expect(scheduleEn.dayMonday).toBe("Monday");
    expect(scheduleEn.dayTuesday).toBe("Tuesday");
    expect(scheduleEn.dayWednesday).toBe("Wednesday");
    expect(scheduleEn.dayThursday).toBe("Thursday");
    expect(scheduleEn.dayFriday).toBe("Friday");
    expect(scheduleEn.daySaturday).toBe("Saturday");
    expect(scheduleEn.daySunday).toBe("Sunday");
  });
});

describe("Session status translations", () => {
  const scheduleEn = (en as NestedMessages).schedule as Record<string, string>;
  const scheduleMk = (mk as NestedMessages).schedule as Record<string, string>;

  it("statusScheduled exists and is 'Scheduled' in English", () => {
    expect(scheduleEn.statusScheduled).toBe("Scheduled");
  });

  it("statusCancelled exists and is 'Cancelled' in English", () => {
    expect(scheduleEn.statusCancelled).toBe("Cancelled");
  });

  it("statusScheduled is translated in Macedonian", () => {
    expect(scheduleMk.statusScheduled).toBeDefined();
    expect(scheduleMk.statusScheduled).not.toBe("Scheduled");
  });

  it("statusCancelled is translated in Macedonian", () => {
    expect(scheduleMk.statusCancelled).toBeDefined();
    expect(scheduleMk.statusCancelled).not.toBe("Cancelled");
  });
});
