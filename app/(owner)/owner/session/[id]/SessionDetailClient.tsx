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
import { DAY_NAMES } from "@/lib/constants";
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

interface SessionDetailClientProps {
  session: SessionData;
  voteMembers: VoteMember[];
  allTrainers: Array<{ id: string; name: string }>;
  allMembers: Array<{ id: string; name: string }>;
}

export function SessionDetailClient({
  session,
  voteMembers,
  allTrainers,
  allMembers,
}: SessionDetailClientProps): React.ReactElement {
  const router = useRouter();
  const { addToast } = useToast();
  const [editingWorkout, setEditingWorkout] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
        body: JSON.stringify({ workoutTitle: title, workoutDetails: details }),
        signal: controller.signal,
      });
      if (res.ok) {
        addToast({ type: "success", title: "Workout updated" });
        setEditingWorkout(false);
        router.refresh();
      } else {
        throw new Error("Failed to save workout");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error("Request timed out. Please try again.");
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function handleCancelSession(): Promise<void> {
    if (!confirm("Are you sure you want to cancel this session? All members will be notified.")) {
      return;
    }
    setCancelling(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (res.ok) {
        addToast({ type: "success", title: "Session cancelled" });
        router.refresh();
      } else {
        addToast({ type: "error", title: "Failed to cancel session" });
      }
    } catch {
      addToast({ type: "error", title: "Network error" });
    } finally {
      setCancelling(false);
    }
  }

  async function handleDeleteSession(): Promise<void> {
    if (
      !confirm(
        "Are you sure you want to permanently delete this session? This cannot be undone."
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        addToast({ type: "success", title: "Session deleted" });
        router.push("/owner/schedule");
      } else {
        addToast({ type: "error", title: "Failed to delete session" });
      }
    } catch {
      addToast({ type: "error", title: "Network error" });
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleVoting(): Promise<void> {
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
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-surface-100">
              {dayName} {time}
            </h1>
            {isCancelled && <Badge variant="error">Cancelled</Badge>}
            {session.votingEnabled && !isCancelled && (
              <Badge variant="primary">Voting Open</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-surface-400">
            Session for week of{" "}
            {new Date(session.weekDate).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            Back
          </Button>
          {!isCancelled && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleCancelSession}
              loading={cancelling}
            >
              Cancel Session
            </Button>
          )}
          <Button
            variant="danger"
            size="sm"
            onClick={handleDeleteSession}
            loading={deleting}
          >
            Delete Session
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          {/* Workout */}
          <Card>
            <CardHeader
              title="Workout"
              action={
                !isCancelled && !editingWorkout ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingWorkout(true)}
                  >
                    Edit
                  </Button>
                ) : undefined
              }
            />
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

          {/* Voting */}
          {session.votingEnabled && (
            <div>
              <VoteSummary members={voteMembers} />
            </div>
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
          {/* Trainers */}
          <Card>
            <CardHeader
              title="Trainers"
              description={`${session.trainers.length} assigned`}
            />
            <div className="mt-3 space-y-2">
              {session.trainers.length === 0 && (
                <p className="text-sm text-surface-500">
                  No trainers assigned
                </p>
              )}
              {session.trainers.map((t) => (
                <div
                  key={t.userId}
                  className="flex items-center justify-between rounded-lg bg-surface-900/50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-surface-200">
                      {t.name}
                    </p>
                    <p className="text-xs text-surface-500">{t.email}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Members */}
          <Card>
            <CardHeader
              title="Members"
              description={`${session.members.length} assigned`}
            />
            <div className="mt-3 space-y-2">
              {session.members.length === 0 && (
                <p className="text-sm text-surface-500">
                  No members assigned
                </p>
              )}
              {session.members.map((m) => (
                <div
                  key={m.userId}
                  className="flex items-center justify-between rounded-lg bg-surface-900/50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-surface-200">
                      {m.name}
                    </p>
                    <p className="text-xs text-surface-500">{m.email}</p>
                  </div>
                  <Badge
                    variant={m.status === "TRIAL" ? "info" : "default"}
                    size="sm"
                  >
                    {m.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
