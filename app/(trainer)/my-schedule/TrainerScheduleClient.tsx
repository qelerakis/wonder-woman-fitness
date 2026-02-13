"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { addDays } from "date-fns";
import { WeeklyCalendar } from "@/components/schedule/WeeklyCalendar";
import { CreateSessionModal } from "@/components/schedule/CreateSessionModal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { SessionWithDetails } from "@/lib/session-generation";

interface TrainerScheduleClientProps {
  initialWeekStart: string;
  userId: string;
}

export function TrainerScheduleClient({
  initialWeekStart,
  userId,
}: TrainerScheduleClientProps): React.ReactElement {
  const [weekStart, setWeekStart] = useState(new Date(initialWeekStart));
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(true); // only for initial load
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { addToast } = useToast();
  const abortRef = useRef<AbortController | null>(null);

  const fetchSessions = useCallback(async (showLoader = false): Promise<void> => {
    // Abort any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    if (showLoader) {
      setLoading(true);
    }
    try {
      const weekDate = weekStart.toISOString().split("T")[0];
      const res = await fetch(`/api/sessions?weekDate=${weekDate}`, {
        signal: controller.signal,
      });
      if (res.ok) {
        const data: { data: SessionWithDetails[] } = await res.json();
        // Show all sessions — isAssigned flag from server distinguishes assigned vs unassigned
        setSessions(data.data);
      } else {
        addToast({ type: "error", title: "Failed to load sessions" });
      }
    } catch (err: unknown) {
      // Don't show error toast for aborted requests
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      addToast({ type: "error", title: "Network error" });
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [weekStart, addToast]);

  useEffect(() => {
    void fetchSessions(true); // show loader on initial load and week change
    return () => {
      abortRef.current?.abort();
    };
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
          currentUserId={userId}
          onWeekChange={handleWeekChange}
        />
      )}

      <CreateSessionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          setShowCreateModal(false);
          void fetchSessions(false); // silent refresh — don't hide the calendar
        }}
        weekStart={weekStart}
      />
    </div>
  );
}
