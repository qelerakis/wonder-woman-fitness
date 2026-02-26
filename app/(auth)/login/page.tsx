"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showVerificationHint, setShowVerificationHint] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setLoading(true);
    setError("");
    setShowVerificationHint(false);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(t("invalidCredentials"));
        setShowVerificationHint(true);
        return;
      }

      // Fetch session to determine role-based redirect
      // credentials: "include" ensures auth cookies are sent with the request
      const res = await fetch("/api/auth/session", {
        credentials: "include",
      });
      const session = await res.json();

      if (session?.user?.role === "OWNER") {
        router.push("/dashboard");
      } else if (session?.user?.role === "TRAINER") {
        router.push("/my-schedule");
      } else {
        router.push("/member/schedule");
      }
    } catch {
      setError(tCommon("unexpectedError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2 className="mb-6 text-center text-2xl font-semibold text-surface-100">
        {t("signIn")}
      </h2>

      {error && (
        <div className="mb-4 rounded-lg border border-error-700/30 bg-error-700/20 p-3 text-sm text-error-500" role="alert">
          {error}
        </div>
      )}

      {showVerificationHint && (
        <div className="mb-4 rounded-lg bg-surface-800 p-3 text-sm text-surface-400">
          {t("recentlyRegistered")}{" "}
          <Link
            href={`/check-email?email=${encodeURIComponent(email)}`}
            className="text-primary-400 hover:text-primary-300"
          >
            {t("resendVerification")}
          </Link>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-surface-300"
          >
            {t("email")}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setShowVerificationHint(false);
            }}
            required
            autoComplete="email"
            className="w-full rounded-lg border border-surface-600 bg-surface-800 px-4 py-2.5 text-surface-100 placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder={t("emailPlaceholder")}
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-surface-300"
          >
            {t("password")}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setShowVerificationHint(false);
            }}
            required
            autoComplete="current-password"
            className="w-full rounded-lg border border-surface-600 bg-surface-800 px-4 py-2.5 text-surface-100 placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder={t("passwordPlaceholder")}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-surface-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? t("signingIn") : t("signIn")}
        </button>
      </form>

      <div className="mt-6 space-y-2 text-center text-sm">
        <p className="text-surface-400">
          {t("noAccount")}{" "}
          <Link
            href="/register"
            className="text-primary-400 hover:text-primary-300"
          >
            {t("register")}
          </Link>
        </p>
        <p>
          <Link
            href="/forgot-password"
            className="text-surface-400 hover:text-surface-300"
          >
            {t("forgotPassword")}
          </Link>
        </p>
      </div>
    </>
  );
}
