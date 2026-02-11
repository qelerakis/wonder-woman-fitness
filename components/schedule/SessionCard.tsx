'use client';

/**
 * SessionCard Component
 *
 * Displays a session in the weekly calendar
 * Shows time, trainer, member count, workout snippet, and status
 */

import { Session, RecurringSlot, User } from '@prisma/client';
import { format } from 'date-fns';
import { addDays, setHours } from 'date-fns';
import { MAX_CLASS_SIZE } from '@/lib/constants';

type SessionWithDetails = Session & {
  recurringSlot: RecurringSlot;
  members: Array<{ user: Pick<User, 'id' | 'name' | 'photo'> }>;
  trainers: Array<{ user: Pick<User, 'id' | 'name' | 'photo'> }>;
};

interface SessionCardProps {
  session: SessionWithDetails;
  onClick?: () => void;
  showWorkout?: boolean;
}

export function SessionCard({ session, onClick, showWorkout = false }: SessionCardProps) {
  const { recurringSlot, members, trainers, workoutTitle, status } = session;

  // Calculate session date/time
  const sessionDate = addDays(session.weekDate, recurringSlot.dayOfWeek - 1);
  const sessionTime = setHours(sessionDate, recurringSlot.startHour);
  const timeString = format(sessionTime, 'h:mm a');

  // Status styling
  const statusColors = {
    SCHEDULED: 'bg-primary/10 text-primary border-primary/20',
    CANCELLED: 'bg-error/10 text-error border-error/20',
  };

  const isFull = members.length >= MAX_CLASS_SIZE;

  return (
    <div
      className={`rounded-lg border p-4 cursor-pointer transition-all hover:shadow-md ${
        status === 'CANCELLED' ? 'opacity-60' : ''
      } ${statusColors[status]}`}
      onClick={onClick}
    >
      {/* Time */}
      <div className="text-sm font-semibold mb-2">{timeString}</div>

      {/* Status badge */}
      {status === 'CANCELLED' && (
        <div className="inline-block px-2 py-1 bg-error text-white text-xs rounded mb-2">
          CANCELLED
        </div>
      )}

      {/* Trainers */}
      {trainers.length > 0 && (
        <div className="text-xs text-surface-400 mb-2">
          Trainer: {trainers.map((t) => t.user.name).join(', ')}
        </div>
      )}

      {/* Member count */}
      <div className="text-xs mb-2">
        <span className={isFull ? 'text-warning' : 'text-surface-300'}>
          {members.length}/{MAX_CLASS_SIZE} members
        </span>
        {isFull && <span className="ml-1 text-warning">(Full)</span>}
      </div>

      {/* Workout title */}
      {showWorkout && workoutTitle && (
        <div className="text-sm font-medium text-surface-100 mt-2 truncate">
          {workoutTitle}
        </div>
      )}

      {!showWorkout && !workoutTitle && (
        <div className="text-xs text-surface-500 italic">No workout posted yet</div>
      )}
    </div>
  );
}
