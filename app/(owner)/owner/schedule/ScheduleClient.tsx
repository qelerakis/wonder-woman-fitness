'use client';

/**
 * ScheduleClient Component
 *
 * Client wrapper for the owner schedule page
 * Manages session selection and modal state
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Session, RecurringSlot, User } from '@prisma/client';
import { WeeklyCalendar } from '@/components/schedule/WeeklyCalendar';
import { SessionDetailModal } from '@/components/schedule/SessionDetailModal';

type SessionWithDetails = Session & {
  recurringSlot: RecurringSlot;
  members: Array<{ user: Pick<User, 'id' | 'name' | 'photo'> }>;
  trainers: Array<{ user: Pick<User, 'id' | 'name' | 'photo'> }>;
};

interface ScheduleClientProps {
  sessions: SessionWithDetails[];
  weekStart: Date;
}

export function ScheduleClient({ sessions, weekStart }: ScheduleClientProps) {
  const router = useRouter();
  const [selectedSession, setSelectedSession] = useState<SessionWithDetails | null>(null);

  const handleSessionClick = (session: SessionWithDetails) => {
    setSelectedSession(session);
  };

  const handleModalClose = () => {
    setSelectedSession(null);
  };

  const handleUpdate = () => {
    router.refresh();
    setSelectedSession(null);
  };

  return (
    <>
      <WeeklyCalendar
        sessions={sessions}
        weekStart={weekStart}
        onSessionClick={handleSessionClick}
        showWorkouts={true}
      />

      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          onClose={handleModalClose}
          onUpdate={handleUpdate}
        />
      )}
    </>
  );
}
