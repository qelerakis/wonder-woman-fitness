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
  };
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
}

export function TrainerSessionDetailClient({
  session,
  voteMembers,
}: TrainerSessionDetailClientProps): React.ReactElement {
  const router = useRouter();
  const { addToast } = useToast();
  const [editingWorkout, setEditingWorkout] = useState(false);

  const dayName = DAY_NAMES[session.recurringSlot.dayOfWeek] || "Unknown";
  const time = formatTime(session.recurringSlot.startHour);
  const isCancelled = session.status === "CANCELLED";

  async function handleSaveWorkout(
    _sessionId: string,
    title: string,
    details: string
  ): Promise<void> {
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workoutTitle: title,
          workoutDetails: details,
        }),
      });

      if (res.ok) {
        addToast({ type: "success", title: "Workout saved" });
        setEditingWorkout(false);
        router.refresh();
      } else {
        addToast({ type: "error", title: "Failed to save workout" });
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

          {/* Members */}
          <Card>
            <CardHeader
              title="Members"
              description={`${session.members.length} assigned`}
            />
            {session.members.length === 0 ? (
              <p className="mt-4 text-sm text-surface-500">
                No members assigned
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {session.members.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between rounded-lg bg-surface-900/50 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-surface-200">
                        {member.name}
                      </p>
                      <p className="text-xs text-surface-400">
                        {member.email}
                      </p>
                    </div>
                    <Badge
                      variant={
                        member.status === "ACTIVE"
                          ? "success"
                          : member.status === "TRIAL"
                            ? "info"
                            : "default"
                      }
                      size="sm"
                    >
                      {member.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Voting Results (read-only) */}
          <Card>
            <CardHeader title="Voting Results" />
            <div className="mt-4">
              <VoteSummary members={voteMembers} />
            </div>
          </Card>

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
