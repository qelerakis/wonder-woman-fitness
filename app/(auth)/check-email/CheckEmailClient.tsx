"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { VERIFICATION_RESEND_COOLDOWN_MS } from "@/lib/constants";

const COOLDOWN_SECONDS = VERIFICATION_RESEND_COOLDOWN_MS / 1000;

export default function CheckEmailClient() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const t = useTranslations("auth");

  const [cooldown, setCooldown] = useState(0);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || status === "sending") return;

    setStatus("sending");
    setErrorMessage("");

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          const data = await res.json();
          setErrorMessage(data.error || t("checkEmailWait"));
        } else {
          setErrorMessage(t("checkEmailResendFailed"));
        }
        setStatus("error");
        return;
      }

      setStatus("sent");
      setCooldown(COOLDOWN_SECONDS);
    } catch {
      setErrorMessage(t("checkEmailResendFailed"));
      setStatus("error");
    }
  }, [email, cooldown, status, t]);

  return (
    <div className="text-center">
      <h2 className="mb-4 text-xl font-semibold text-surface-100">
        {t("checkEmail")}
      </h2>

      <p className="mb-6 text-surface-400">
        {t("checkEmailSent")}{" "}
        <span className="font-medium text-surface-200">{email || t("checkEmailYourEmail")}</span>.
        {" "}{t("checkEmailClickLink")}
      </p>

      {errorMessage && (
        <div className="mb-4 rounded-lg bg-error-50 p-3 text-sm text-error-700">
          {errorMessage}
        </div>
      )}

      {status === "sent" && (
        <div className="mb-4 rounded-lg bg-success-50 p-3 text-sm text-success-700">
          {t("checkEmailResent")}
        </div>
      )}

      <button
        onClick={handleResend}
        disabled={cooldown > 0 || status === "sending"}
        className="mb-4 w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "sending"
          ? t("checkEmailSending")
          : cooldown > 0
            ? t("checkEmailResendIn", { cooldown })
            : t("checkEmailResendButton")}
      </button>

      <p className="text-sm text-surface-500">
        {t("checkEmailWrongEmail")}{" "}
        <Link href="/register" className="text-primary-400 hover:text-primary-300">
          {t("checkEmailRegisterAgain")}
        </Link>
      </p>
    </div>
  );
}
