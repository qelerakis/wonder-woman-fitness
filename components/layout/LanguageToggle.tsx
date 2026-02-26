"use client";

import { useLocale } from "next-intl";

const localeOptions = [
  { code: "mk", label: "\u041C\u041A" },
  { code: "en", label: "EN" },
] as const;

export function LanguageToggle(): React.ReactElement {
  const currentLocale = useLocale();

  function switchLocale(newLocale: string): void {
    if (newLocale === currentLocale) return;
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000`;
    window.location.reload();
  }

  return (
    <div className="flex items-center rounded-lg border border-surface-700 overflow-hidden">
      {localeOptions.map((option) => (
        <button
          key={option.code}
          onClick={() => switchLocale(option.code)}
          className={`px-2 py-1 text-xs font-medium transition-colors ${
            currentLocale === option.code
              ? "bg-primary-600 text-white"
              : "bg-surface-800 text-surface-400 hover:text-surface-200"
          }`}
          aria-label={`Switch to ${option.code === "mk" ? "Macedonian" : "English"}`}
          aria-pressed={currentLocale === option.code}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
