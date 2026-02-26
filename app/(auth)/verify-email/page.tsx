import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { verifyEmailToken } from "./actions";

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;
  const t = await getTranslations("auth");

  if (!token) {
    return (
      <div className="text-center">
        <h2 className="mb-4 text-xl font-semibold text-error-400">
          {t("verifyInvalidLink")}
        </h2>
        <p className="mb-6 text-surface-400">
          {t("verifyNoToken")}
        </p>
        <Link
          href="/register"
          className="text-primary-400 hover:text-primary-300"
        >
          {t("verifyBackToRegister")}
        </Link>
      </div>
    );
  }

  const result = await verifyEmailToken(token);

  if (!result.success) {
    return (
      <div className="text-center">
        <h2 className="mb-4 text-xl font-semibold text-error-400">
          {t("verifyFailed")}
        </h2>
        <p className="mb-6 text-surface-400">
          {result.error}
        </p>
        <Link
          href="/register"
          className="text-primary-400 hover:text-primary-300"
        >
          {t("verifyRegisterAgain")}
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h2 className="mb-4 text-xl font-semibold text-success-400">
        {t("verifySuccess")}
      </h2>
      <p className="mb-6 text-surface-400">
        {t("verifySuccessMessage")}
      </p>
      <Link
        href="/login"
        className="inline-block rounded-lg bg-primary-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-primary-700"
      >
        {t("signIn")}
      </Link>
    </div>
  );
}
