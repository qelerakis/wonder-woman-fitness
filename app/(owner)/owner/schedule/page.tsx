/**
 * Owner Schedule Management Page
 *
 * Weekly calendar view with:
 * - Auto-generated sessions from recurring slots
 * - Session creation and editing
 * - Member and trainer assignment
 * - Workout posting
 */

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getSessionsForWeek, getWeekStart } from '@/lib/session-generation';
import { ScheduleClient } from './ScheduleClient';

export default async function OwnerSchedulePage() {
  // 1. Verify authentication and role
  const session = await auth();
  if (!session) {
    redirect('/login');
  }

  if (session.user.role !== 'OWNER') {
    redirect('/login');
  }

  // 2. Get current week (defaults to this week)
  const today = new Date();
  const weekStart = getWeekStart(today);

  // 3. Get or generate sessions for this week
  const sessions = await getSessionsForWeek(weekStart);

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-surface-100 mb-2">Schedule Management</h1>
          <p className="text-surface-400">
            View and manage your weekly class schedule
          </p>
        </div>

        {/* Week navigation (TODO: Add prev/next week buttons) */}
        <div className="mb-6">
          <div className="text-sm text-surface-400">
            Week of {weekStart.toLocaleDateString()}
          </div>
        </div>

        {/* Weekly calendar with interactive modal */}
        <ScheduleClient sessions={sessions} weekStart={weekStart} />

        {/* Quick stats */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-primary">{sessions.length}</div>
            <div className="text-sm text-surface-400">Total sessions this week</div>
          </div>

          <div className="bg-surface-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-success">
              {sessions.filter((s) => s.workoutTitle).length}
            </div>
            <div className="text-sm text-surface-400">Workouts posted</div>
          </div>

          <div className="bg-surface-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-warning">
              {sessions.filter((s) => s.status === 'CANCELLED').length}
            </div>
            <div className="text-sm text-surface-400">Cancelled sessions</div>
          </div>
        </div>
      </div>
    </div>
  );
}
