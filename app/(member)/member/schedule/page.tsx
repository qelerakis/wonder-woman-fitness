/**
 * Member Schedule View
 *
 * Read-only weekly calendar with:
 * - Workout details
 * - Voting buttons (if enabled and before deadline)
 * - Future weeks visible
 */

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getSessionsForWeek, getWeekStart } from '@/lib/session-generation';
import { ScheduleClient } from './ScheduleClient';

interface SearchParams {
  week?: string;
}

export default async function MemberSchedulePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // 1. Verify authentication and role
  const session = await auth();
  if (!session) {
    redirect('/login');
  }

  if (session.user.role !== 'MEMBER') {
    redirect('/login');
  }

  // 2. Get current week or week from query param
  const weekParam = searchParams.week;
  const targetDate = weekParam ? new Date(weekParam) : new Date();
  const weekStart = getWeekStart(targetDate);

  // 3. Get sessions for this week
  const sessions = await getSessionsForWeek(weekStart);

  return (
    <ScheduleClient
      sessions={sessions}
      weekStart={weekStart}
      userId={session.user.id}
    />
  );
}
