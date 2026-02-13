"use client";

import { useState } from "react";
import { addDays, format } from "date-fns";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { DAY_NAMES } from "@/lib/constants";
import { formatTime } from "@/components/schedule/SessionCard";

interface SlotInfo {
  id: string;
  dayOfWeek: number;
  startHour: number;
  trainerName: string | null;
}

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  weekStart: Date;
  recurringSlots: SlotInfo[];
  existingSlotIds: string[];
}

export function CreateSessionModal({
  isOpen,
  onClose,
  onCreated,
  weekStart,
  recurringSlots,
  existingSlotIds,
}: CreateSessionModalProps): React.ReactElement | null {
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();

  const slotOptions = recurringSlots.map((slot) => ({
    value: slot.id,
    label: `${DAY_NAMES[slot.dayOfWeek]} ${formatTime(slot.startHour)}${
      slot.trainerName ? ` — ${slot.trainerName}` : ""
    }`,
    disabled: existingSlotIds.includes(slot.id),
  }));

  function handleClose(): void {
    if (!submitting) {
      setSelectedSlotId("");
      onClose();
    }
  }

  async function handleSubmit(): Promise<void> {
    if (!selectedSlotId) return;

    setSubmitting(true);
    try {
      const weekDate = format(weekStart, "yyyy-MM-dd");
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recurringSlotId: selectedSlotId,
          weekDate,
        }),
      });

      if (res.status === 201) {
        addToast({ type: "success", title: "Session created" });
        setSelectedSlotId("");
        onCreated();
      } else if (res.status === 409) {
        addToast({
          type: "error",
          title: "Session already exists",
          message: "A session for this slot and week already exists.",
        });
      } else if (res.status === 404) {
        addToast({
          type: "error",
          title: "Slot not found",
          message: "The selected recurring slot no longer exists.",
        });
      } else {
        addToast({ type: "error", title: "Failed to create session" });
      }
    } catch {
      addToast({ type: "error", title: "Network error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Session" size="sm">
      <div className="space-y-4">
        {/* Week display */}
        <div>
          <p className="text-sm font-medium text-surface-200 mb-1">Week</p>
          <p className="text-sm text-surface-400">
            {format(weekStart, "MMM d, yyyy")} –{" "}
            {format(addDays(weekStart, 6), "MMM d, yyyy")}
          </p>
        </div>

        {/* Slot selector */}
        <Select
          label="Time Slot"
          placeholder="Select a time slot"
          options={slotOptions}
          value={selectedSlotId}
          onChange={(e) => setSelectedSlotId(e.target.value)}
          disabled={submitting}
          helpText={
            existingSlotIds.length > 0
              ? "Slots with existing sessions are disabled."
              : undefined
          }
        />

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            loading={submitting}
            disabled={!selectedSlotId || submitting}
          >
            Create Session
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export type { CreateSessionModalProps, SlotInfo };
