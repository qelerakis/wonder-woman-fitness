"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { DAY_NAMES } from "@/lib/constants";
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
  const [deleteFutureSessions, setDeleteFutureSessions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayName = DAY_NAMES[dayOfWeek] || "Unknown";
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
        setError(data.error || "Failed to delete recurring slot");
      }
    } catch {
      setError("Network error. Please try again.");
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
    <Modal isOpen={isOpen} onClose={handleClose} title="Delete Recurring Slot" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-surface-300">
          Permanently remove the <span className="font-semibold text-surface-100">{dayName} {time}</span> recurring slot.
        </p>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-surface-200">What should happen?</legend>

          <label className="flex items-start gap-3 rounded-lg border border-surface-700 p-3 cursor-pointer hover:border-surface-500 transition-colors">
            <input
              type="radio"
              name="deleteMode"
              checked={!deleteFutureSessions}
              onChange={() => setDeleteFutureSessions(false)}
              className="mt-0.5 accent-primary-500"
            />
            <div>
              <p className="text-sm font-medium text-surface-100">Stop future generation only</p>
              <p className="text-xs text-surface-400 mt-0.5">
                The slot template will be removed. Already scheduled sessions stay on the calendar.
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
              <p className="text-sm font-medium text-surface-100">Delete slot and all upcoming sessions</p>
              <p className="text-xs text-surface-400 mt-0.5">
                Removes the template and all sessions from this week onward. Past sessions are kept for records. Members will be notified.
              </p>
            </div>
          </label>
        </fieldset>

        {error && (
          <p className="text-sm text-error-400">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete} loading={loading}>
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  );
}
