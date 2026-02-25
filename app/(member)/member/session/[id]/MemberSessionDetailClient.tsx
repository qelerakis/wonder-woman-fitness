"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { WorkoutDisplay } from "@/components/schedule/WorkoutDisplay";
import { useToast } from "@/components/ui/Toast";
import { format } from "date-fns";
import { DAY_NAMES, VOTING_URGENCY_HOURS } from "@/lib/constants";
import { formatTime } from "@/components/schedule/SessionCard";

// Mirrors getTimeUntilDeadline from lib/voting-logic.ts.
// Cannot import directly because voting-logic.ts imports from @/generated/prisma/client,
// which is incompatible with "use client" components (see CLAUDE.md gotcha #12).
function getTimeUntil(deadline: Date, now: Date): { hours: number; minutes: number; isPast: boolean } {
  const diff = deadline.getTime() - now.getTime();
  if (diff < 0) return { hours: 0, minutes: 0, isPast: true };
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { hours, minutes, isPast: false };
}

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
  trainerNames: string[];
  comingMemberNames: string[];
  assignedMemberNames: string[];
  votesCount: {
    coming: number;
  };
}

interface MemberSessionDetailClientProps {
  session: SessionData;
  myVote: boolean | null;
  userId: string;
  isFull: boolean;
  hasComingVoteOnSameDay: boolean;
  isAssigned: boolean;
}

export function MemberSessionDetailClient(
  props: MemberSessionDetailClientProps
): React.ReactElement {
  const { session, myVote, isFull, hasComingVoteOnSameDay, isAssigned } = props;
  const router = useRouter();
  const { addToast } = useToast();
  const [voting, setVoting] = useState(false);
  const [currentVote, setCurrentVote] = useState<boolean | null>(myVote);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const dayOfWeek = session.recurringSlot?.dayOfWeek ?? session.customDay ?? 1;
  const startHour = session.recurringSlot?.startHour ?? session.customStartHour ?? 0;
  const dayName = DAY_NAMES[dayOfWeek] || "Unknown";
  const time = formatTime(startHour);
  const isCancelled = session.status === "CANCELLED";
  const deadline = new Date(session.votingDeadline);
  const deadlinePassed = deadline <= now;
  const timeUntil = getTimeUntil(deadline, now);
  const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
  const isUrgent = !timeUntil.isPast && hoursUntilDeadline <= VOTING_URGENCY_HOURS;
  const votingActive = session.votingEnabled && !deadlinePassed;
  const canVote = votingActive && !isCancelled && !isFull;

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
              <>
                <Badge variant="info" size="sm">
                  Voting Open
                </Badge>
                <span className={`text-xs ${isUrgent ? "text-warning-400" : "text-surface-400"}`}>
                  {isUrgent
                    ? `Closes in ${timeUntil.hours}h ${timeUntil.minutes}m`
                    : `Closes ${format(deadline, "EEE, MMM d 'at' h:mm a")}`}
                </span>
              </>
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
                          currentVote === true ? "success" : "secondary"
                        }
                        size="sm"
                        onClick={() => handleVote(true)}
                        loading={voting}
                        disabled={hasComingVoteOnSameDay && currentVote !== true}
                        className={currentVote === true ? "ring-2 ring-success-500/50" : ""}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        I&apos;m Coming
                      </Button>
                      <Button
                        variant={
                          currentVote === false ? "danger" : "secondary"
                        }
                        size="sm"
                        onClick={() => handleVote(false)}
                        loading={voting}
                        className={currentVote === false ? "ring-2 ring-error-500/50" : ""}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Not Coming
                      </Button>
                    </div>
                    {hasComingVoteOnSameDay && currentVote !== true && (
                      <p className="text-xs text-warning-400">
                        You&apos;re already coming to another session on this day.
                      </p>
                    )}
                    {currentVote !== null && (
                      <p className="text-xs text-surface-500">
                        You can change your vote until{" "}
                        {format(deadline, "EEE, MMM d 'at' h:mm a")}.
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
          {/* Who's Coming — shown when voting is active */}
          {votingActive && (
            <Card>
              <CardHeader
                title="Who's Coming"
                description={`${session.votesCount.coming} confirmed`}
              />
              {session.comingMemberNames.length === 0 ? (
                <p className="mt-4 text-sm text-surface-500">
                  No one has confirmed yet
                </p>
              ) : (
                <div className="mt-4 space-y-1.5">
                  {session.comingMemberNames.map((name) => (
                    <div
                      key={name}
                      className="flex items-center gap-2 rounded-md bg-success-600/10 px-3 py-1.5"
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success-700 text-xs font-bold text-white">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <p className="text-sm text-surface-200">{name}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Assigned Members — shown for non-voting sessions when assigned */}
          {!session.votingEnabled && isAssigned && (
            <Card>
              <CardHeader
                title="Members"
                description={`${session.assignedMemberNames.length} assigned`}
              />
              {session.assignedMemberNames.length === 0 ? (
                <p className="mt-4 text-sm text-surface-500">
                  No members assigned yet
                </p>
              ) : (
                <div className="mt-4 space-y-1.5">
                  {session.assignedMemberNames.map((name) => (
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
          )}

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
