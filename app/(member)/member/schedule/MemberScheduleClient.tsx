"use client";

import { useState, useEffect, useCallback } from "react";
import { addDays } from "date-fns";
import { WeeklyCalendar } from "@/components/schedule/WeeklyCalendar";
import { useToast } from "@/components/ui/Toast";
import type { SessionWithDetails } from "@/lib/session-generation";

interface MemberScheduleClientProps {
  initialWeekStart: string;
  userId: string;
}

export function MemberScheduleClient({
  initialWeekStart,
  userId,
}: MemberScheduleClientProps): React.ReactElement {
  const [weekStart, setWeekStart] = useState(new Date(initialWeekStart));
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const weekDate = weekStart.toISOString().split("T")[0];
      const res = await fetch(`/api/sessions?weekDate=${weekDate}`);
      if (res.ok) {
        const data: { data: SessionWithDetails[] } = await res.json();
        setSessions(data.data);
      } else {
        addToast({ type: "error", title: "Failed to load schedule" });
      }
    } catch {
      addToast({ type: "error", title: "Network error" });
    } finally {
      setLoading(false);
    }
  }, [weekStart, addToast]);

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
      <div>
        <h1 className="text-2xl font-bold text-surface-100">My Schedule</h1>
        <p className="mt-1 text-sm text-surface-400">
          View your upcoming classes and vote on attendance
        </p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="text-sm text-surface-500">Loading schedule...</div>
        </div>
      ) : (
        <WeeklyCalendar
          weekStart={weekStart}
          sessions={sessions}
          basePath="/member/session"
          showVotingIndicator
          currentUserId={userId}
          onWeekChange={handleWeekChange}
        />
      )}
    </div>
  );
}
