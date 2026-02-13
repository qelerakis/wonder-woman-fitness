"use client";

import { useState, useEffect, useCallback } from "react";
import { addDays } from "date-fns";
import { WeeklyCalendar } from "@/components/schedule/WeeklyCalendar";
import { CreateSessionModal } from "@/components/schedule/CreateSessionModal";
import type { SlotInfo } from "@/components/schedule/CreateSessionModal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { SessionWithDetails } from "@/lib/session-generation";

interface TrainerScheduleClientProps {
  initialWeekStart: string;
  userId: string;
  recurringSlots: SlotInfo[];
}

export function TrainerScheduleClient({
  initialWeekStart,
  userId,
  recurringSlots,
}: TrainerScheduleClientProps): React.ReactElement {
  const [weekStart, setWeekStart] = useState(new Date(initialWeekStart));
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
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
        // Filter for sessions assigned to this trainer
        const mySessions = data.data.filter((s) =>
          s.trainers.some((t) => t.userId === userId)
        );
        setSessions(mySessions);
      } else {
        addToast({ type: "error", title: "Failed to load sessions" });
      }
    } catch {
      addToast({ type: "error", title: "Network error" });
    } finally {
      setLoading(false);
    }
  }, [weekStart, userId, addToast]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  function handleWeekChange(direction: "prev" | "next"): void {
    setWeekStart((prev) =>
      direction === "next" ? addDays(prev, 7) : addDays(prev, -7)
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">My Schedule</h1>
          <p className="mt-1 text-sm text-surface-400">
            Sessions you are assigned to train
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowCreateModal(true)}
        >
          Add Session
        </Button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="text-sm text-surface-500">Loading sessions...</div>
        </div>
      ) : (
        <WeeklyCalendar
          weekStart={weekStart}
          sessions={sessions}
          basePath="/trainer/session"
          showVotingIndicator
          onWeekChange={handleWeekChange}
        />
      )}

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
