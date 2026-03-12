"use client";

import { useTranslations } from "next-intl";

export function Footer(): React.ReactElement {
  const t = useTranslations("footer");

  return (
    <footer className="w-full py-4 text-center text-xs text-surface-500">
      {t("madeBy")}
    </footer>
  );
}
