import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import CheckEmailClient from "./CheckEmailClient";

export default async function CheckEmailPage() {
  const tCommon = await getTranslations("common");

  return (
    <Suspense fallback={<div className="text-center text-surface-400">{tCommon("loading")}</div>}>
      <CheckEmailClient />
    </Suspense>
  );
}
