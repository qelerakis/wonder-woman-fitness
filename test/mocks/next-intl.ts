// test/mocks/next-intl.ts
import { vi } from "vitest";
import en from "../../messages/en.json";

type Messages = Record<string, string | Record<string, string | Record<string, string>>>;

function getNamespaceMessages(namespace: string): Record<string, string> {
  const ns = (en as Messages)[namespace];
  if (!ns || typeof ns === "string") return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(ns)) {
    if (typeof value === "string") {
      result[key] = value;
    }
  }
  return result;
}

function createTranslationFn(namespace?: string) {
  const messages = namespace ? getNamespaceMessages(namespace) : {};
  return (key: string, values?: Record<string, unknown>): string => {
    let text = messages[key] ?? (namespace ? `${namespace}.${key}` : key);
    if (values) {
      for (const [k, v] of Object.entries(values)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
      // Handle simple ICU plural: {count, plural, one {# day} other {# days}}
      text = text.replace(
        /\{(\w+), plural, one \{([^}]*)\} other \{([^}]*)\}\}/g,
        (_match, varName, oneForm, otherForm) => {
          const count = Number(values[varName] ?? 0);
          const form = count === 1 ? oneForm : otherForm;
          return form.replace("#", String(count));
        }
      );
    }
    return text;
  };
}

// Client-side hooks
vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => createTranslationFn(namespace),
  useLocale: () => "en",
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Server-side functions
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace?: string) => createTranslationFn(namespace),
  getLocale: async () => "en",
  getMessages: async () => en,
}));
