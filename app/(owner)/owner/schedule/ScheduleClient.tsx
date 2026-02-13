"use client";

import { useState, useEffect, useCallback } from "react";
import { addDays } from "date-fns";
import { WeeklyCalendar } from "@/components/schedule/WeeklyCalendar";
import { CreateSessionModal } from "@/components/schedule/CreateSessionModal";
import type { SlotInfo } from "@/components/schedule/CreateSessionModal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { SessionWithDetails } from "@/lib/session-generation";

interface PersonInfo {
  id: string;
  name: string;
  email: string;
}

interface ScheduleClientProps {
  initialWeekStart: string;
  recurringSlots: SlotInfo[];
  trainers: PersonInfo[];
  members: PersonInfo[];
}

export function ScheduleClient({
  initialWeekStart,
  recurringSlots,
  trainers,
  members,
}: ScheduleClientProps): React.ReactElement {
  const [weekStart, setWeekStart] = useState(new Date(initialWeekStart));
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { addToast } = useToast();

  const existingSlotIds = sessions
    .filter((s) => s.recurringSlotId != null)
    .map((s) => s.recurringSlotId as string);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const weekDate = weekStart.toISOString().split("T")[0];
      const res = await fetch(`/api/sessions?weekDate=${weekDate}`);
      if (res.ok) {
        const data: { data: SessionWithDetails[] } = await res.json();
        setSessions(data.data);
      } else {
        addToast({
          type: "error",
          title: "Failed to load sessions",
        });
      }
    } catch {
      addToast({
        type: "error",
        title: "Network error loading sessions",
      });
    } finally {
      setLoading(false);
    }
  }, [weekStart, addToast]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  function handleWeekChange(direction: "prev" | "next"): void {
    setWeekStart((prev) =>
      direction === "next" ? addDays(prev, 7) : addDays(prev, -7)
    );
  }

  async function handleGenerateWeek(): Promise<void> {
    setGenerating(true);
    try {
      const res = await fetch("/api/sessions/generate-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekDate: weekStart.toISOString().split("T")[0],
        }),
      });
      if (res.ok) {
        addToast({
          type: "success",
          title: "Sessions generated",
          message: "Weekly sessions have been created from recurring slots.",
        });
        await fetchSessions();
      } else {
        const errorData: { error: string } = await res.json();
        addToast({
          type: "error",
          title: "Failed to generate sessions",
          message: errorData.error,
        });
      }
    } catch {
      addToast({
        type: "error",
        title: "Network error generating sessions",
      });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">Schedule</h1>
          <p className="mt-1 text-sm text-surface-400">
            Manage weekly class schedule
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleGenerateWeek}
            loading={generating}
          >
            Generate Week
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
          >
            Add Session
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="flex gap-4 text-sm">
        <span className="text-surface-400">
          <span className="font-medium text-surface-200">
            {sessions.length}
          </span>{" "}
          sessions
        </span>
        <span className="text-surface-400">
          <span className="font-medium text-surface-200">
            {sessions.filter((s) => s.status === "CANCELLED").length}
          </span>{" "}
          cancelled
        </span>
        <span className="text-surface-400">
          <span className="font-medium text-surface-200">
            {recurringSlots.length}
          </span>{" "}
          recurring slots
        </span>
      </div>

      {/* Calendar */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="text-sm text-surface-500">Loading sessions...</div>
        </div>
      ) : (
        <WeeklyCalendar
          weekStart={weekStart}
          sessions={sessions}
          basePath="/owner/session"
          showVotingIndicator
          onWeekChange={handleWeekChange}
        />
      )}

      {/* Create session modal */}
      <CreateSessionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          setShowCreateModal(false);
          fetchSessions();
        }}
        weekStart={weekStart}
        recurringSlots={recurringSlots}
        existingSlotIds={existingSlotIds}
      />
    </div>
  );
}
