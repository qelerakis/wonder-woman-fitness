"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { WorkoutDisplay } from "@/components/schedule/WorkoutDisplay";
import { useToast } from "@/components/ui/Toast";
import { format } from "date-fns";
import { VOTING_URGENCY_HOURS } from "@/lib/constants";
import { getDateLocale } from "@/lib/date-locale";
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
  const t = useTranslations("schedule");
  const tCommon = useTranslations("common");
  const tWorkout = useTranslations("workout");
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);

  const dayKeys: Record<number, string> = { 1: "dayMonday", 2: "dayTuesday", 3: "dayWednesday", 4: "dayThursday", 5: "dayFriday", 6: "daySaturday", 7: "daySunday" };
  const [voting, setVoting] = useState(false);
  const [currentVote, setCurrentVote] = useState<boolean | null>(myVote);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const dayOfWeek = session.recurringSlot?.dayOfWeek ?? session.customDay ?? 1;
  const startHour = session.recurringSlot?.startHour ?? session.customStartHour ?? 0;
  const dayName = t(dayKeys[dayOfWeek] || "dayMonday");
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
            ? t("youreComingBanner")
            : t("youreNotComingBanner"),
        });
        router.refresh();
      } else {
        const data: { error: string } = await res.json();
        addToast({
          type: "error",
          title: t("failedToVote"),
          message: data.error,
        });
      }
    } catch {
      addToast({ type: "error", title: tCommon("networkError") });
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
              {isCancelled ? t("statusCancelled") : t("statusScheduled")}
            </Badge>
            {session.votingEnabled && !deadlinePassed && (
              <>
                <Badge variant="info" size="sm">
                  {t("votingOpen")}
                </Badge>
                <span className={`text-xs ${isUrgent ? "text-warning-400" : "text-surface-400"}`}>
                  {isUrgent
                    ? t("votingClosesIn", { hours: timeUntil.hours, minutes: timeUntil.minutes })
                    : t("votingClosesAt", { deadline: format(deadline, "EEE, MMM d, HH:mm", { locale: dateLocale }) })}
                </span>
              </>
            )}
            {deadlinePassed && session.votingEnabled && (
              <Badge variant="default" size="sm">
                {t("votingClosed")}
              </Badge>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          {tCommon("back")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          {/* Workout */}
          <Card>
            <CardHeader title={tWorkout("title")} />
            <div className="mt-4">
              <WorkoutDisplay
                title={session.workoutTitle}
                details={session.workoutDetails}
              />
            </div>
          </Card>

          {/* Voting — only for sessions with voting enabled */}
          {!isCancelled && session.votingEnabled && (
            <Card>
              <CardHeader title={t("yourAttendance")} />
              <div className="mt-4">
                {isFull ? (
                  <div className="space-y-2">
                    <Badge variant="warning" size="sm">{t("full")}</Badge>
                    <p className="text-sm text-surface-500">
                      {t("fullMessage")}
                    </p>
                  </div>
                ) : canVote ? (
                  <div className="space-y-3">
                    <p className="text-sm text-surface-400">
                      {t("willYouAttend")}
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
                        {t("imComingButton")}
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
                        {t("notComingButton")}
                      </Button>
                    </div>
                    {hasComingVoteOnSameDay && currentVote !== true && (
                      <p className="text-xs text-warning-400">
                        {t("alreadyComingToday")}
                      </p>
                    )}
                    {currentVote !== null && (
                      <p className="text-xs text-surface-500">
                        {t("changeVoteUntil", { deadline: format(deadline, "EEE, MMM d, HH:mm", { locale: dateLocale }) })}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    {currentVote !== null ? (
                      <p className="text-sm text-surface-300">
                        {t("youVoted")}{" "}
                        <span
                          className={`font-medium ${
                            currentVote
                              ? "text-success-400"
                              : "text-error-400"
                          }`}
                        >
                          {currentVote ? t("comingStatus") : t("notComingStatus")}
                        </span>
                      </p>
                    ) : (
                      <p className="text-sm text-surface-500">
                        {t("votingDeadlinePassed")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Assigned status — for non-voting sessions when member is assigned */}
          {!isCancelled && !session.votingEnabled && isAssigned && (
            <Card>
              <CardHeader title={t("yourAttendance")} />
              <div className="mt-4">
                <p className="text-sm text-surface-300">
                  {t("youAreAssigned")}
                </p>
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
                title={t("whosComing")}
                description={t("confirmed", { count: session.votesCount.coming })}
              />
              {session.comingMemberNames.length === 0 ? (
                <p className="mt-4 text-sm text-surface-500">
                  {t("noOneConfirmed")}
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
                title={t("membersCardTitle")}
                description={t("membersAssigned", { count: session.assignedMemberNames.length })}
              />
              {session.assignedMemberNames.length === 0 ? (
                <p className="mt-4 text-sm text-surface-500">
                  {t("noMembersAssigned")}
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
            <CardHeader title={t("trainersTitle")} />
            {session.trainerNames.length === 0 ? (
              <p className="mt-4 text-sm text-surface-500">
                {t("noTrainerAssigned")}
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
