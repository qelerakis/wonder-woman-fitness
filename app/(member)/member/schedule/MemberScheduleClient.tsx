"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">My Schedule</h1>
          <p className="mt-1 text-sm text-surface-400">
            View your upcoming classes and vote on attendance
          </p>
        </div>
        <button
          onClick={() => router.refresh()}
          className="rounded-lg p-2.5 text-surface-400 hover:bg-surface-800 hover:text-surface-200 transition-colors"
          aria-label="Refresh schedule"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
              clipRule="evenodd"
            />
          </svg>
        </button>
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
