"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { WorkoutEditor } from "@/components/schedule/WorkoutEditor";
import { WorkoutDisplay } from "@/components/schedule/WorkoutDisplay";
import { VoteSummary } from "@/components/schedule/VoteSummary";
import { useToast } from "@/components/ui/Toast";
import { AssignmentToggleList } from "@/components/schedule/AssignmentToggleList";
import { DAY_NAMES, MAX_CLASS_SIZE } from "@/lib/constants";
import { formatTime } from "@/components/schedule/SessionCard";
import type { VoteMember } from "@/components/schedule/VoteSummary";

interface SessionData {
  id: string;
  weekDate: string;
  status: string;
  workoutTitle: string | null;
  workoutDetails: string | null;
  votingEnabled: boolean;
  recurringSlot: {
    dayOfWeek: number;
    startHour: number;
  } | null;
  customDay: number | null;
  customStartHour: number | null;
  members: Array<{
    userId: string;
    name: string;
    email: string;
    status: string;
  }>;
  trainers: Array<{
    userId: string;
    name: string;
    email: string;
  }>;
}

interface TrainerSessionDetailClientProps {
  session: SessionData;
  voteMembers: VoteMember[];
  allMembers: Array<{ id: string; name: string }>;
}

export function TrainerSessionDetailClient({
  session,
  voteMembers,
  allMembers,
}: TrainerSessionDetailClientProps): React.ReactElement {
  const router = useRouter();
  const { addToast } = useToast();
  const [editingWorkout, setEditingWorkout] = useState(false);
  const [currentMemberIds, setCurrentMemberIds] = useState<string[]>(
    session.members.map((m) => m.userId)
  );

  const dayOfWeek = session.recurringSlot?.dayOfWeek ?? session.customDay ?? 1;
  const startHour = session.recurringSlot?.startHour ?? session.customStartHour ?? 0;
  const dayName = DAY_NAMES[dayOfWeek] || "Unknown";
  const time = formatTime(startHour);
  const isCancelled = session.status === "CANCELLED";

  async function handleSaveWorkout(
    _sessionId: string,
    title: string,
    details: string
  ): Promise<void> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workoutTitle: title,
          workoutDetails: details,
        }),
        signal: controller.signal,
      });

      if (res.ok) {
        addToast({ type: "success", title: "Workout saved" });
        setEditingWorkout(false);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        addToast({
          type: "error",
          title: "Failed to save workout",
          message: data.error || `Server returned ${res.status}`,
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        addToast({
          type: "error",
          title: "Request timed out",
          message: "The server took too long to respond. Please try again.",
        });
      } else {
        addToast({ type: "error", title: "Network error" });
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function handleToggleVoting(): Promise<void> {
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingEnabled: !session.votingEnabled }),
      });
      if (res.ok) {
        addToast({
          type: "success",
          title: session.votingEnabled ? "Voting disabled" : "Voting enabled",
        });
        router.refresh();
      } else {
        addToast({ type: "error", title: "Failed to update voting" });
      }
    } catch {
      addToast({ type: "error", title: "Network error" });
    }
  }

  async function handleToggleMember(userId: string, currentlyAssigned: boolean): Promise<void> {
    const action = currentlyAssigned ? "remove" : "add";
    try {
      const res = await fetch(`/api/sessions/${session.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentMemberIds(data.data.map((m: { userId: string }) => m.userId));
        addToast({ type: "success", title: currentlyAssigned ? "Member removed" : "Member assigned" });
        router.refresh();
      } else {
        const err = await res.json();
        addToast({ type: "error", title: err.error || "Failed to update" });
      }
    } catch {
      addToast({ type: "error", title: "Network error" });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">
            {dayName} {time}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge
              variant={isCancelled ? "error" : "success"}
              size="sm"
            >
              {session.status}
            </Badge>
            {session.votingEnabled && (
              <Badge variant="info" size="sm">
                Voting Open
              </Badge>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          Back
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          {/* Workout */}
          <Card>
            <div className="flex items-center justify-between">
              <CardHeader title="Workout" />
              {!isCancelled && !editingWorkout && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingWorkout(true)}
                >
                  Edit
                </Button>
              )}
            </div>
            <div className="mt-4">
              {editingWorkout ? (
                <WorkoutEditor
                  sessionId={session.id}
                  initialTitle={session.workoutTitle || ""}
                  initialDetails={session.workoutDetails || ""}
                  onSave={handleSaveWorkout}
                  onCancel={() => setEditingWorkout(false)}
                />
              ) : (
                <WorkoutDisplay
                  title={session.workoutTitle}
                  details={session.workoutDetails}
                />
              )}
            </div>
          </Card>

          {/* Members — only shown when voting is disabled */}
          {!session.votingEnabled && (
            <AssignmentToggleList
              title="Members"
              people={allMembers}
              assignedIds={currentMemberIds}
              onToggle={handleToggleMember}
              disabled={isCancelled}
              maxCapacity={MAX_CLASS_SIZE}
              currentCount={currentMemberIds.length}
            />
          )}

          {/* Toggle voting */}
          {!isCancelled && (
            <Button variant="ghost" size="sm" onClick={handleToggleVoting}>
              {session.votingEnabled ? "Disable Voting" : "Enable Voting"}
            </Button>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Voting Results — only shown when voting is enabled */}
          {session.votingEnabled && (
            <Card>
              <CardHeader title="Voting Results" />
              <div className="mt-4">
                <VoteSummary members={voteMembers} />
              </div>
            </Card>
          )}

          {/* Trainers */}
          <Card>
            <CardHeader title="Trainers" />
            {session.trainers.length === 0 ? (
              <p className="mt-4 text-sm text-surface-500">
                No trainers assigned
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {session.trainers.map((trainer) => (
                  <div
                    key={trainer.userId}
                    className="flex items-center gap-3 rounded-lg bg-surface-900/50 px-3 py-2"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-700 text-xs font-bold text-white">
                      {trainer.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-surface-200">
                        {trainer.name}
                      </p>
                      <p className="text-xs text-surface-400">
                        {trainer.email}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
