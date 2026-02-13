import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { MAX_CLASS_SIZE } from "@/lib/constants";
import type { SessionWithDetails } from "@/lib/session-generation";

interface SessionCardProps {
  session: SessionWithDetails;
  basePath: string;
  showVotingIndicator?: boolean;
  currentUserId?: string;
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
}: SessionCardProps): React.ReactElement {
  const time = formatTime(session.recurringSlot.startHour);
  const memberCount = session.members.length;
  const trainerNames = session.trainers.map((t) => t.user.name).join(", ");
  const isCancelled = session.status === "CANCELLED";

  // Voting status for current user
  const userVote = currentUserId
    ? session.votes.find((v) => v.userId === currentUserId)
    : null;
  const yesVotes = session.votes.filter((v) => v.attending).length;
  const noVotes = session.votes.filter((v) => !v.attending).length;

  return (
    <Link
      href={`${basePath}/${session.id}`}
      className={`
        group block rounded-lg border p-3
        transition-all duration-150
        ${
          isCancelled
            ? "border-surface-700 bg-surface-800/50 opacity-60"
            : "border-surface-700 bg-surface-800 hover:border-primary-600/50 hover:bg-surface-700"
        }
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
          {memberCount}/{MAX_CLASS_SIZE} members
        </span>
        {showVotingIndicator && session.votingEnabled && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-success-500">{yesVotes} yes</span>
            <span className="text-error-500">{noVotes} no</span>
          </div>
        )}
        {showVotingIndicator && userVote !== undefined && userVote !== null && (
          <Badge
            variant={userVote.attending ? "success" : "error"}
            size="sm"
          >
            {userVote.attending ? "Going" : "Not going"}
          </Badge>
        )}
      </div>
    </Link>
  );
}

export { formatTime };
export type { SessionCardProps };
