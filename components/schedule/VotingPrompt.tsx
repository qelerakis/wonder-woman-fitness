"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/Button";
import { format } from "date-fns";
import { getDateLocale } from "@/lib/date-locale";

interface VotingPromptProps {
  sessionId: string;
  votingDeadline: Date;
  currentVote?: boolean | null;
  onVote: (sessionId: string, attending: boolean) => Promise<void>;
  disabled?: boolean;
}

export function VotingPrompt({
  sessionId,
  votingDeadline,
  currentVote,
  onVote,
  disabled = false,
}: VotingPromptProps): React.ReactElement {
  const t = useTranslations("schedule");
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const [loading, setLoading] = useState<"yes" | "no" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isPastDeadline = new Date() > votingDeadline;
  const isDisabled = disabled || isPastDeadline;

  async function handleVote(attending: boolean): Promise<void> {
    setLoading(attending ? "yes" : "no");
    setError(null);
    try {
      await onVote(sessionId, attending);
    } catch {
      setError(t("failedToSubmitVote"));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="rounded-lg border border-surface-700 bg-surface-800 p-4">
      <div className="mb-3">
        <h4 className="text-sm font-medium text-surface-200">
          {t("willYouAttend")}
        </h4>
        <p className="mt-1 text-xs text-surface-400">
          {isPastDeadline ? (
            <span className="text-warning-500">{t("votingHasClosed")}</span>
          ) : (
            <span className="font-medium text-surface-300">
              {t("voteByDeadline", { deadline: format(votingDeadline, "EEE, MMM d, HH:mm", { locale: dateLocale }) })}
            </span>
          )}
        </p>
      </div>

      {error && (
        <p className="mb-3 text-sm text-error-500" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button
          variant={currentVote === true ? "success" : "secondary"}
          size="sm"
          disabled={isDisabled}
          loading={loading === "yes"}
          onClick={() => handleVote(true)}
          className={currentVote === true ? "ring-2 ring-success-500/50" : ""}
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          {t("imComing")}
        </Button>
        <Button
          variant={currentVote === false ? "danger" : "secondary"}
          size="sm"
          disabled={isDisabled}
          loading={loading === "no"}
          onClick={() => handleVote(false)}
          className={currentVote === false ? "ring-2 ring-error-500/50" : ""}
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
          {t("imNotComing")}
        </Button>
      </div>
    </div>
  );
}

export type { VotingPromptProps };
