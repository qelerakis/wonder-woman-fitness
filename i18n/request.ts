import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const locales = ["mk", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "mk";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const locale =
    cookieLocale && locales.includes(cookieLocale as Locale)
      ? cookieLocale
      : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
