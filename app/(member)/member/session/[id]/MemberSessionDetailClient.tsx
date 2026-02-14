"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { WorkoutDisplay } from "@/components/schedule/WorkoutDisplay";
import { useToast } from "@/components/ui/Toast";
import { DAY_NAMES } from "@/lib/constants";
import { formatTime } from "@/components/schedule/SessionCard";

interface SessionData {
  id: string;
  weekDate: string;
  status: string;
  workoutTitle: string | null;
  workoutDetails: string | null;
  votingEnabled: boolean;
  votingDeadline: string;
  recurringSlot: {
    dayOfWeek: number;
    startHour: number;
  } | null;
  customDay: number | null;
  customStartHour: number | null;
  memberNames: string[];
  trainerNames: string[];
  totalMembers: number;
  votesCount: {
    coming: number;
    notComing: number;
  };
}

interface MemberSessionDetailClientProps {
  session: SessionData;
  myVote: boolean | null;
  userId: string;
  isFull: boolean;
  hasComingVoteOnSameDay: boolean;
}

export function MemberSessionDetailClient(
  props: MemberSessionDetailClientProps
): React.ReactElement {
  const { session, myVote, isFull, hasComingVoteOnSameDay } = props;
  const router = useRouter();
  const { addToast } = useToast();
  const [voting, setVoting] = useState(false);
  const [currentVote, setCurrentVote] = useState<boolean | null>(myVote);

  const dayOfWeek = session.recurringSlot?.dayOfWeek ?? session.customDay ?? 1;
  const startHour = session.recurringSlot?.startHour ?? session.customStartHour ?? 0;
  const dayName = DAY_NAMES[dayOfWeek] || "Unknown";
  const time = formatTime(startHour);
  const isCancelled = session.status === "CANCELLED";
  const deadlinePassed = new Date(session.votingDeadline) <= new Date();
  const canVote = session.votingEnabled && !deadlinePassed && !isCancelled && !isFull;

  async function handleVote(attending: boolean): Promise<void> {
    setVoting(true);
    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          attending,
        }),
      });

      if (res.ok) {
        setCurrentVote(attending);
        addToast({
          type: "success",
          title: attending
            ? "You're marked as coming!"
            : "You're marked as not coming",
        });
        router.refresh();
      } else {
        const data: { error: string } = await res.json();
        addToast({
          type: "error",
          title: "Failed to vote",
          message: data.error,
        });
      }
    } catch {
      addToast({ type: "error", title: "Network error" });
    } finally {
      setVoting(false);
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
            {session.votingEnabled && !deadlinePassed && (
              <Badge variant="info" size="sm">
                Voting Open
              </Badge>
            )}
            {deadlinePassed && session.votingEnabled && (
              <Badge variant="default" size="sm">
                Voting Closed
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
            <CardHeader title="Workout" />
            <div className="mt-4">
              <WorkoutDisplay
                title={session.workoutTitle}
                details={session.workoutDetails}
              />
            </div>
          </Card>

          {/* Voting */}
          {!isCancelled && (
            <Card>
              <CardHeader title="Your Attendance" />
              <div className="mt-4">
                {isFull ? (
                  <div className="space-y-2">
                    <Badge variant="warning" size="sm">Full</Badge>
                    <p className="text-sm text-surface-500">
                      This session is full — voting is closed.
                    </p>
                  </div>
                ) : canVote ? (
                  <div className="space-y-3">
                    <p className="text-sm text-surface-400">
                      Will you attend this session?
                    </p>
                    <div className="flex gap-3">
                      <Button
                        variant={
                          currentVote === true ? "primary" : "secondary"
                        }
                        size="sm"
                        onClick={() => handleVote(true)}
                        loading={voting}
                        disabled={hasComingVoteOnSameDay && currentVote !== true}
                      >
                        {currentVote === true ? "✓ I'm Coming" : "I'm Coming"}
                      </Button>
                      <Button
                        variant={
                          currentVote === false ? "danger" : "ghost"
                        }
                        size="sm"
                        onClick={() => handleVote(false)}
                        loading={voting}
                      >
                        {currentVote === false
                          ? "✓ Not Coming"
                          : "Not Coming"}
                      </Button>
                    </div>
                    {hasComingVoteOnSameDay && currentVote !== true && (
                      <p className="text-xs text-warning-400">
                        You&apos;re already coming to another session on this day.
                      </p>
                    )}
                    {currentVote !== null && (
                      <p className="text-xs text-surface-500">
                        You can change your vote until the deadline.
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    {currentVote !== null ? (
                      <p className="text-sm text-surface-300">
                        You voted:{" "}
                        <span
                          className={`font-medium ${
                            currentVote
                              ? "text-success-400"
                              : "text-error-400"
                          }`}
                        >
                          {currentVote ? "Coming" : "Not coming"}
                        </span>
                      </p>
                    ) : (
                      <p className="text-sm text-surface-500">
                        {deadlinePassed
                          ? "Voting deadline has passed."
                          : "Voting is not open for this session."}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Attendance Summary */}
          <Card>
            <CardHeader title="Attendance" />
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-400">Coming</span>
                <span className="text-sm font-medium text-success-400">
                  {session.votesCount.coming}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-400">Not coming</span>
                <span className="text-sm font-medium text-error-400">
                  {session.votesCount.notComing}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-surface-400">No vote yet</span>
                <span className="text-sm font-medium text-surface-500">
                  {session.totalMembers -
                    session.votesCount.coming -
                    session.votesCount.notComing}
                </span>
              </div>
            </div>
          </Card>

          {/* Group Members */}
          <Card>
            <CardHeader
              title="Group Members"
              description={`${session.memberNames.length} members`}
            />
            {session.memberNames.length === 0 ? (
              <p className="mt-4 text-sm text-surface-500">
                No members assigned
              </p>
            ) : (
              <div className="mt-4 space-y-1.5">
                {session.memberNames.map((name) => (
                  <div
                    key={name}
                    className="rounded-md bg-surface-900/50 px-3 py-1.5"
                  >
                    <p className="text-sm text-surface-300">{name}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Trainers */}
          <Card>
            <CardHeader title="Trainers" />
            {session.trainerNames.length === 0 ? (
              <p className="mt-4 text-sm text-surface-500">
                No trainer assigned
              </p>
            ) : (
              <div className="mt-4 space-y-1.5">
                {session.trainerNames.map((name) => (
                  <div
                    key={name}
                    className="flex items-center gap-2 rounded-md bg-surface-900/50 px-3 py-1.5"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-700 text-xs font-bold text-white">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <p className="text-sm text-surface-300">{name}</p>
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
