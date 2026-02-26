"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { MAX_DEPART_REASON_LENGTH } from "@/lib/constants";

interface StopTrainingClientProps {
  userId: string;
  userName: string;
}

export function StopTrainingClient({
  userId,
  userName,
}: StopTrainingClientProps): React.ReactElement {
  const router = useRouter();
  const { addToast } = useToast();
  const t = useTranslations("stopTraining");
  const tCommon = useTranslations("common");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleStopTraining(): Promise<void> {
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "DEPARTED",
          departReason: reason.trim() || undefined,
        }),
      });

      if (res.ok) {
        addToast({ type: "success", title: t("accountDeactivated") });
        router.push("/member/departed");
      } else {
        addToast({ type: "error", title: t("failedToProcess") });
      }
    } catch {
      addToast({ type: "error", title: tCommon("networkError") });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-100">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-surface-400">
          {t("greeting", { userName })}
        </p>
      </div>

      <Card>
        <CardHeader
          title={t("areYouSure")}
          description={t("deactivateWarning")}
        />

        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-warning-700/30 bg-warning-700/10 px-4 py-3">
            <h3 className="text-sm font-medium text-warning-500">
              {t("whatHappens")}
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-warning-400">
              <li>
                &bull; {t("consequence1")}
              </li>
              <li>
                &bull; {t("consequence2")}
              </li>
              <li>
                &bull; {t("consequence3")}
              </li>
              <li>
                &bull; {t("consequence4")}
              </li>
            </ul>
          </div>

          <Textarea
            label={t("reasonLabel")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("reasonPlaceholder")}
            rows={3}
            helpText={t("reasonCharCount", { count: reason.length, max: MAX_DEPART_REASON_LENGTH })}
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="confirm-depart"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="h-4 w-4 rounded border-surface-600 bg-surface-800 text-primary-500 focus:ring-primary-500"
            />
            <label
              htmlFor="confirm-depart"
              className="text-sm text-surface-300"
            >
              {t("confirmCheckbox")}
            </label>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="danger"
              onClick={handleStopTraining}
              loading={loading}
              disabled={!confirmed}
            >
              {t("stopButton")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.back()}
            >
              {tCommon("cancel")}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
