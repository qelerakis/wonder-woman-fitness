import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/Badge";
import { MAX_CLASS_SIZE, VOTING_URGENCY_HOURS } from "@/lib/constants";
import type { SessionWithDetails } from "@/lib/session-generation";

interface SessionCardProps {
  session: SessionWithDetails;
  basePath: string;
  showVotingIndicator?: boolean;
  currentUserId?: string;
  isAssigned?: boolean;
}

function formatTime(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:00 ${period}`;
}

export function SessionCard({
  session,
  basePath,
  showVotingIndicator = false,
  currentUserId,
  isAssigned = false,
}: SessionCardProps): React.ReactElement {
  const time = formatTime(session.recurringSlot?.startHour ?? session.customStartHour ?? 0);
  const comingCount = session.votes.filter((v) => v.attending).length;
  const memberCount = session.members.length;
  const trainerNames = session.trainers.map((t) => t.user.name).join(", ");
  const isCancelled = session.status === "CANCELLED";

  // Voting deadline display
  const deadline = session.votingDeadline ? new Date(session.votingDeadline) : null;
  const now = new Date();
  const deadlineInFuture = deadline ? deadline > now : false;
  const hoursUntilDeadline = deadline ? (deadline.getTime() - now.getTime()) / (1000 * 60 * 60) : Infinity;
  const isUrgent = hoursUntilDeadline <= VOTING_URGENCY_HOURS;

  // Voting status for current user
  const userVote = currentUserId
    ? session.votes.find((v) => v.userId === currentUserId)
    : null;

  // Card background color based on member state
  const needsVote = showVotingIndicator && currentUserId && session.votingEnabled && !isCancelled && !userVote;
  const isGoing = (userVote?.attending === true) || isAssigned;

  function getCardClasses(): string {
    if (isCancelled) {
      return "border-surface-700 bg-surface-800/50 opacity-60";
    }
    if (needsVote) {
      return "border-warning-500/40 bg-warning-500/30 hover:border-warning-400/50 hover:bg-warning-500/40";
    }
    if (isGoing) {
      return "border-success-600/40 bg-success-600/25 hover:border-success-500/50 hover:bg-success-600/35";
    }
    return "border-surface-700 bg-surface-800 hover:border-primary-600/50 hover:bg-surface-700";
  }

  const showDeadline = showVotingIndicator && session.votingEnabled && !isCancelled && deadlineInFuture && !userVote;

  return (
    <Link
      href={`${basePath}/${session.id}`}
      className={`
        group block rounded-lg border p-3
        transition-all duration-150
        ${getCardClasses()}
      `}
    >
      {/* Time + Status */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-semibold text-surface-100">{time}</span>
        {isCancelled && (
          <Badge variant="error" size="sm">
            Cancelled
          </Badge>
        )}
        {!isCancelled && session.votingEnabled && showVotingIndicator && (
          <Badge variant="primary" size="sm">
            Voting
          </Badge>
        )}
      </div>

      {/* Workout title */}
      {session.workoutTitle && (
        <p className="text-sm font-medium text-surface-200 truncate mb-1">
          {session.workoutTitle}
        </p>
      )}

      {/* Trainer */}
      {trainerNames && (
        <p className="text-xs text-surface-400 truncate mb-2">
          {trainerNames}
        </p>
      )}

      {/* Footer: member count + voting info */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-surface-500">
          {session.votingEnabled ? comingCount : memberCount}/{MAX_CLASS_SIZE}{" "}
          {session.votingEnabled ? "coming" : "members"}
        </span>
        {showVotingIndicator && userVote !== undefined && userVote !== null && (
          <Badge
            variant={userVote.attending ? "success" : "error"}
            size="sm"
          >
            {userVote.attending ? "Going" : "Not going"}
          </Badge>
        )}
        {showDeadline && deadline && (
          <span className={`text-xs ${isUrgent ? "text-warning-400" : "text-surface-500"}`}>
            by {format(deadline, "EEE h a")}
          </span>
        )}
      </div>
    </Link>
  );
}

export { formatTime };
export type { SessionCardProps };
