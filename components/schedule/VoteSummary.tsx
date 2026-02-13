import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface VoteMember {
  userId: string;
  name: string;
  attending: boolean | null;
}

interface VoteSummaryProps {
  members: VoteMember[];
  showActions?: boolean;
  onCancel?: () => void;
  onMove?: () => void;
}

export function VoteSummary({
  members,
  showActions = false,
  onCancel,
  onMove,
}: VoteSummaryProps): React.ReactElement {
  const attending = members.filter((m) => m.attending === true);
  const notAttending = members.filter((m) => m.attending === false);
  const noVote = members.filter((m) => m.attending === null);

  return (
    <div className="rounded-lg border border-surface-700 bg-surface-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-surface-200">
          Voting Results
        </h4>
        <div className="flex items-center gap-2">
          <Badge variant="success" size="sm">
            {attending.length} yes
          </Badge>
          <Badge variant="error" size="sm">
            {notAttending.length} no
          </Badge>
          <Badge variant="default" size="sm">
            {noVote.length} pending
          </Badge>
        </div>
      </div>

      {/* Attending */}
      {attending.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-success-500">
            Coming ({attending.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {attending.map((m) => (
              <span
                key={m.userId}
                className="rounded-md bg-success-700/10 px-2 py-1 text-xs text-success-400 border border-success-700/20"
              >
                {m.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Not attending */}
      {notAttending.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-error-500">
            Not Coming ({notAttending.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {notAttending.map((m) => (
              <span
                key={m.userId}
                className="rounded-md bg-error-700/10 px-2 py-1 text-xs text-error-400 border border-error-700/20"
              >
                {m.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Didn't vote */}
      {noVote.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-surface-500">
            No Vote ({noVote.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {noVote.map((m) => (
              <span
                key={m.userId}
                className="rounded-md bg-surface-700/50 px-2 py-1 text-xs text-surface-400"
              >
                {m.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Owner actions */}
      {showActions && (
        <div className="mt-3 flex gap-2 border-t border-surface-700 pt-3">
          {onCancel && (
            <Button variant="danger" size="sm" onClick={onCancel}>
              Cancel Session
            </Button>
          )}
          {onMove && (
            <Button variant="secondary" size="sm" onClick={onMove}>
              Move Members
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export type { VoteSummaryProps, VoteMember };
