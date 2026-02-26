"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatTime } from "@/components/schedule/SessionCard";

interface DeleteRecurringSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  slotId: string;
  dayOfWeek: number;
  startHour: number;
  onDeleted: () => void;
}

export function DeleteRecurringSlotModal({
  isOpen,
  onClose,
  slotId,
  dayOfWeek,
  startHour,
  onDeleted,
}: DeleteRecurringSlotModalProps): React.ReactElement | null {
  const t = useTranslations("deleteSlot");
  const tc = useTranslations("common");
  const ts = useTranslations("schedule");
  const [deleteFutureSessions, setDeleteFutureSessions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayKeys: Record<number, string> = { 1: "dayMonday", 2: "dayTuesday", 3: "dayWednesday", 4: "dayThursday", 5: "dayFriday", 6: "daySaturday", 7: "daySunday" };
  const dayName = ts(dayKeys[dayOfWeek] || "dayMonday");
  const time = formatTime(startHour);

  async function handleDelete(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recurring-slots", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: slotId, deleteFutureSessions }),
      });

      if (res.ok) {
        onDeleted();
      } else {
        const data = await res.json();
        setError(data.error || t("failedToDelete"));
      }
    } catch {
      setError(t("networkError"));
    } finally {
      setLoading(false);
    }
  }

  function handleClose(): void {
    if (!loading) {
      setDeleteFutureSessions(false);
      setError(null);
      onClose();
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t("title")} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-surface-300">
          {t("description", { day: dayName, time })}
        </p>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-surface-200">{t("whatShouldHappen")}</legend>

          <label className="flex items-start gap-3 rounded-lg border border-surface-700 p-3 cursor-pointer hover:border-surface-500 transition-colors">
            <input
              type="radio"
              name="deleteMode"
              checked={!deleteFutureSessions}
              onChange={() => setDeleteFutureSessions(false)}
              className="mt-0.5 accent-primary-500"
            />
            <div>
              <p className="text-sm font-medium text-surface-100">{t("stopFutureOnly")}</p>
              <p className="text-xs text-surface-400 mt-0.5">
                {t("stopFutureDescription")}
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-surface-700 p-3 cursor-pointer hover:border-surface-500 transition-colors">
            <input
              type="radio"
              name="deleteMode"
              checked={deleteFutureSessions}
              onChange={() => setDeleteFutureSessions(true)}
              className="mt-0.5 accent-primary-500"
            />
            <div>
              <p className="text-sm font-medium text-surface-100">{t("deleteSlotAndSessions")}</p>
              <p className="text-xs text-surface-400 mt-0.5">
                {t("deleteSlotAndSessionsDescription")}
              </p>
            </div>
          </label>
        </fieldset>

        {error && (
          <p className="text-sm text-error-400">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={loading}>
            {tc("cancel")}
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete} loading={loading}>
            {tc("delete")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
