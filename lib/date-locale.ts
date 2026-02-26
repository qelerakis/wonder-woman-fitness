import { mk, enUS } from "date-fns/locale";
import type { Locale as DateFnsLocale } from "date-fns";

export function getDateLocale(locale: string): DateFnsLocale {
  return locale === "mk" ? mk : enUS;
}
