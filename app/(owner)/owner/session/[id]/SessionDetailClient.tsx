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
import { DeleteRecurringSlotModal } from "@/components/schedule/DeleteRecurringSlotModal";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
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
  recurringSlotId: string | null;
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
  const [currentTrainerIds, setCurrentTrainerIds] = useState<string[]>(
    session.trainers.map((t) => t.userId)
  );
  const [currentMemberIds, setCurrentMemberIds] = useState<string[]>(
    session.members.map((m) => m.userId)
  );
  const [showDeleteSlotModal, setShowDeleteSlotModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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

  async function handleCancelConfirmed(): Promise<void> {
    setCancelling(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (res.ok) {
        setShowCancelModal(false);
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

  async function handleDeleteConfirmed(): Promise<void> {
    setDeleting(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setShowDeleteModal(false);
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

  function handleSlotDeleted(): void {
    setShowDeleteSlotModal(false);
    addToast({ type: "success", title: "Recurring slot deleted" });
    router.push("/owner/schedule");
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

  async function handleToggleTrainer(userId: string, currentlyAssigned: boolean): Promise<void> {
    const action = currentlyAssigned ? "remove" : "add";
    try {
      const res = await fetch(`/api/sessions/${session.id}/trainers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentTrainerIds(data.data.map((t: { userId: string }) => t.userId));
        addToast({ type: "success", title: currentlyAssigned ? "Trainer removed" : "Trainer assigned" });
        router.refresh();
      } else {
        const err = await res.json();
        addToast({ type: "error", title: err.error || "Failed to update" });
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
              onClick={() => setShowCancelModal(true)}
            >
              Cancel Session
            </Button>
          )}
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowDeleteModal(true)}
          >
            Delete Session
          </Button>
          {session.recurringSlotId && session.recurringSlot && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowDeleteSlotModal(true)}
            >
              Delete Recurring Slot
            </Button>
          )}
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
          <AssignmentToggleList
            title="Trainers"
            people={allTrainers}
            assignedIds={currentTrainerIds}
            onToggle={handleToggleTrainer}
            disabled={isCancelled}
          />

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
        </div>
      </div>

      <ConfirmationModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancelConfirmed}
        title="Cancel Session"
        message="Cancel this session? All assigned members will be notified."
        confirmLabel="Cancel Session"
        loading={cancelling}
      />

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirmed}
        title="Delete Session"
        message="Permanently delete this session? This cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
      />

      {session.recurringSlotId && session.recurringSlot && (
        <DeleteRecurringSlotModal
          isOpen={showDeleteSlotModal}
          onClose={() => setShowDeleteSlotModal(false)}
          slotId={session.recurringSlotId}
          dayOfWeek={session.recurringSlot.dayOfWeek}
          startHour={session.recurringSlot.startHour}
          onDeleted={handleSlotDeleted}
        />
      )}
    </div>
  );
}
