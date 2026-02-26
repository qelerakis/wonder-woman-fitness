"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { WorkoutEditor } from "@/components/schedule/WorkoutEditor";
import { WorkoutDisplay } from "@/components/schedule/WorkoutDisplay";
import { VoteSummary } from "@/components/schedule/VoteSummary";
import { useToast } from "@/components/ui/Toast";
import { AssignmentToggleList } from "@/components/schedule/AssignmentToggleList";
import { AttendanceChecklist } from "@/components/schedule/AttendanceChecklist";
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
  attendanceMembers: Array<{ userId: string; name: string; present: boolean | null }>;
  hasStarted: boolean;
}

export function SessionDetailClient({
  session,
  voteMembers,
  allTrainers,
  allMembers,
  attendanceMembers,
  hasStarted,
}: SessionDetailClientProps): React.ReactElement {
  const router = useRouter();
  const { addToast } = useToast();
  const t = useTranslations("schedule");
  const tCommon = useTranslations("common");
  const tWorkout = useTranslations("workout");
  const tDetail = useTranslations("sessionDetail");
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
        addToast({ type: "success", title: tWorkout("updated") });
        setEditingWorkout(false);
        router.refresh();
      } else {
        throw new Error(tWorkout("failedToSave"));
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error(tCommon("requestTimeout"));
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
        addToast({ type: "success", title: tDetail("sessionCancelled") });
        router.refresh();
      } else {
        addToast({ type: "error", title: tDetail("failedToCancel") });
      }
    } catch {
      addToast({ type: "error", title: tCommon("networkError") });
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
        addToast({ type: "success", title: tDetail("sessionDeleted") });
        router.push("/owner/schedule");
      } else {
        addToast({ type: "error", title: tDetail("failedToDelete") });
      }
    } catch {
      addToast({ type: "error", title: tCommon("networkError") });
    } finally {
      setDeleting(false);
    }
  }

  function handleSlotDeleted(): void {
    setShowDeleteSlotModal(false);
    addToast({ type: "success", title: tDetail("slotDeleted") });
    router.push("/owner/schedule");
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
          title: session.votingEnabled ? t("votingDisabled") : t("votingEnabled"),
        });
        router.refresh();
      } else {
        addToast({ type: "error", title: t("failedToUpdateVoting") });
      }
    } catch {
      addToast({ type: "error", title: tCommon("networkError") });
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
        addToast({ type: "success", title: currentlyAssigned ? tDetail("trainerRemoved") : tDetail("trainerAssigned") });
        router.refresh();
      } else {
        const err = await res.json();
        addToast({ type: "error", title: err.error || tDetail("failedToUpdateTrainer") });
      }
    } catch {
      addToast({ type: "error", title: tCommon("networkError") });
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
        addToast({ type: "success", title: currentlyAssigned ? tDetail("memberRemoved") : tDetail("memberAssigned") });
        router.refresh();
      } else {
        const err = await res.json();
        addToast({ type: "error", title: err.error || tDetail("failedToUpdateTrainer") });
      }
    } catch {
      addToast({ type: "error", title: tCommon("networkError") });
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
            {isCancelled && <Badge variant="error">{t("cancelled")}</Badge>}
            {session.votingEnabled && !isCancelled && (
              <Badge variant="primary">{t("votingOpen")}</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-surface-400">
            {tDetail("sessionForWeekOf")}{" "}
            {new Date(session.weekDate).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            {tCommon("back")}
          </Button>
          {!isCancelled && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowCancelModal(true)}
            >
              {tDetail("cancelSession")}
            </Button>
          )}
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowDeleteModal(true)}
          >
            {tDetail("deleteSession")}
          </Button>
          {session.recurringSlotId && session.recurringSlot && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowDeleteSlotModal(true)}
            >
              {tDetail("deleteRecurringSlot")}
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
              title={tWorkout("title")}
              action={
                !isCancelled && !editingWorkout ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingWorkout(true)}
                  >
                    {tCommon("edit")}
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
              {session.votingEnabled ? t("disableVoting") : t("enableVoting")}
            </Button>
          )}

          {/* Attendance — only shown after session has started */}
          {hasStarted && !isCancelled && (
            <AttendanceChecklist
              sessionId={session.id}
              members={attendanceMembers}
              allActiveMembers={allMembers}
            />
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <AssignmentToggleList
            title={t("trainersTitle")}
            people={allTrainers}
            assignedIds={currentTrainerIds}
            onToggle={handleToggleTrainer}
            disabled={isCancelled}
          />

          {!session.votingEnabled && (
            <AssignmentToggleList
              title={t("membersCardTitle")}
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
        title={tDetail("cancelSession")}
        message={tDetail("cancelSessionConfirm")}
        confirmLabel={tDetail("cancelSession")}
        loading={cancelling}
      />

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirmed}
        title={tDetail("deleteSession")}
        message={tDetail("deleteSessionConfirm")}
        confirmLabel={tCommon("delete")}
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
