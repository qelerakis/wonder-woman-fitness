'use client';

/**
 * Schedule Client Component
 *
 * Handles client-side interactions for the schedule view
 */

import { Session, RecurringSlot, User } from '@prisma/client';
import { WeeklyCalendar } from '@/components/schedule/WeeklyCalendar';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type SessionWithDetails = Session & {
  recurringSlot: RecurringSlot;
  members: Array<{ user: Pick<User, 'id' | 'name' | 'photo'> }>;
  trainers: Array<{ user: Pick<User, 'id' | 'name' | 'photo'> }>;
};

interface ScheduleClientProps {
  sessions: SessionWithDetails[];
  weekStart: Date;
  userId: string;
}

export function ScheduleClient({ sessions, weekStart }: ScheduleClientProps) {
  const router = useRouter();

  const handleSessionClick = (session: SessionWithDetails) => {
    router.push(`/member/session/${session.id}`);
  };

  // Calculate previous and next week dates
  const prevWeek = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const nextWeek = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-surface-100 mb-2">Weekly Schedule</h1>
          <p className="text-surface-400">
            View your class schedule and workouts
          </p>
        </div>

        {/* Week navigation */}
        <div className="mb-6 flex items-center justify-between">
          <div className="text-sm text-surface-400">
            Week of {weekStart.toLocaleDateString()}
          </div>
          <div className="flex gap-2">
            <Link
              href={`/member/schedule?week=${prevWeek.toISOString()}`}
              className="px-4 py-2 bg-surface-800 text-surface-100 rounded-lg hover:bg-surface-700 text-sm"
            >
              Previous Week
            </Link>
            <Link
              href={`/member/schedule?week=${nextWeek.toISOString()}`}
              className="px-4 py-2 bg-surface-800 text-surface-100 rounded-lg hover:bg-surface-700 text-sm"
            >
              Next Week
            </Link>
          </div>
        </div>

        {/* Weekly calendar */}
        <WeeklyCalendar
          sessions={sessions}
          weekStart={weekStart}
          showWorkouts={true}
          onSessionClick={handleSessionClick}
        />
      </div>
    </div>
  );
}
