"use client";

import { useState } from "react";
import { addDays, format } from "date-fns";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { DAY_NAMES, SLOT_START_HOUR, SLOT_END_HOUR } from "@/lib/constants";
import { formatTime } from "@/components/schedule/SessionCard";

type TabMode = "oneoff" | "recurring";

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  weekStart: Date;
}

const DAY_OPTIONS = Array.from({ length: 7 }, (_, i) => ({
  value: String(i + 1),
  label: DAY_NAMES[i + 1] as string,
}));

const HOUR_OPTIONS = Array.from(
  { length: SLOT_END_HOUR - SLOT_START_HOUR + 1 },
  (_, i) => {
    const hour = SLOT_START_HOUR + i;
    return { value: String(hour), label: formatTime(hour) };
  }
);

export function CreateSessionModal({
  isOpen,
  onClose,
  onCreated,
  weekStart,
}: CreateSessionModalProps): React.ReactElement | null {
  const [tab, setTab] = useState<TabMode>("oneoff");
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedHour, setSelectedHour] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();

  function resetForm(): void {
    setSelectedDay("");
    setSelectedHour("");
  }

  function handleClose(): void {
    if (!submitting) {
      resetForm();
      setTab("oneoff");
      onClose();
    }
  }

  function handleTabChange(newTab: TabMode): void {
    if (!submitting) {
      resetForm();
      setTab(newTab);
    }
  }

  const canSubmit = !!selectedDay && !!selectedHour;

  async function handleSubmit(): Promise<void> {
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const weekDate = format(weekStart, "yyyy-MM-dd");

      if (tab === "oneoff") {
        // One-off session
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customDay: Number(selectedDay),
            customStartHour: Number(selectedHour),
            weekDate,
          }),
        });

        if (res.status === 201) {
          addToast({ type: "success", title: "One-off session created" });
          resetForm();
          onCreated();
        } else if (res.status === 409) {
          addToast({
            type: "error",
            title: "Time conflict",
            message: "A session already exists at this day and time.",
          });
        } else {
          addToast({ type: "error", title: "Failed to create session" });
        }
      } else {
        // New recurring slot + session
        const day = Number(selectedDay);
        const hour = Number(selectedHour);

        // Step 1: Create the recurring slot
        const slotRes = await fetch("/api/recurring-slots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dayOfWeek: day, startHour: hour }),
        });

        if (slotRes.status === 409) {
          addToast({
            type: "error",
            title: "Slot already exists",
            message: "A recurring slot already exists at this day and time.",
          });
          return;
        }

        if (!slotRes.ok) {
          addToast({ type: "error", title: "Failed to create recurring slot" });
          return;
        }

        const slotData: { data: { id: string } } = await slotRes.json();

        // Step 2: Create session for this week
        const sessionRes = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recurringSlotId: slotData.data.id,
            weekDate,
          }),
        });

        if (sessionRes.status === 201) {
          addToast({
            type: "success",
            title: "Recurring slot & session created",
            message: `New ${DAY_NAMES[day]} ${formatTime(hour)} slot created.`,
          });
          resetForm();
          onCreated();
        } else {
          addToast({
            type: "error",
            title: "Slot created but session failed",
            message: "The recurring slot was created. Try generating the week to create the session.",
          });
        }
      }
    } catch {
      addToast({ type: "error", title: "Network error" });
    } finally {
      setSubmitting(false);
    }
  }

  const TABS: Array<{ key: TabMode; label: string }> = [
    { key: "oneoff", label: "One-Off" },
    { key: "recurring", label: "New Recurring" },
  ];

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

        {/* Tab navigation */}
        <div className="flex rounded-lg bg-surface-800 p-1" role="tablist">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => handleTabChange(key)}
              disabled={submitting}
              className={`
                flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors
                ${
                  tab === key
                    ? "bg-primary-600 text-white"
                    : "text-surface-400 hover:text-surface-200"
                }
                disabled:opacity-50
              `}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "oneoff" && (
          <div className="space-y-3">
            <p className="text-xs text-surface-400">
              Create a one-time session that won&apos;t repeat in future weeks.
            </p>
            <Select
              label="Day"
              placeholder="Select day"
              options={DAY_OPTIONS}
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              disabled={submitting}
            />
            <Select
              label="Time"
              placeholder="Select time"
              options={HOUR_OPTIONS}
              value={selectedHour}
              onChange={(e) => setSelectedHour(e.target.value)}
              disabled={submitting}
            />
          </div>
        )}

        {tab === "recurring" && (
          <div className="space-y-3">
            <p className="text-xs text-surface-400">
              Create a new recurring time slot and a session for this week.
            </p>
            <Select
              label="Day"
              placeholder="Select day"
              options={DAY_OPTIONS}
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              disabled={submitting}
            />
            <Select
              label="Time"
              placeholder="Select time"
              options={HOUR_OPTIONS}
              value={selectedHour}
              onChange={(e) => setSelectedHour(e.target.value)}
              disabled={submitting}
            />
          </div>
        )}

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
            disabled={!canSubmit || submitting}
          >
            {tab === "recurring" ? "Create Slot & Session" : "Create Session"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export type { CreateSessionModalProps };
