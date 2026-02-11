'use client';

/**
 * Session Detail Client Component
 *
 * Handles client-side voting interactions
 */

import { Session, RecurringSlot, User, Vote } from '@prisma/client';
import { VotingPrompt } from '@/components/schedule/VotingPrompt';
import Link from 'next/link';
import { format, addDays, setHours } from 'date-fns';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type SessionWithDetails = Session & {
  recurringSlot: RecurringSlot;
  members: Array<{ user: Pick<User, 'id' | 'name' | 'photo'> }>;
  trainers: Array<{ user: Pick<User, 'id' | 'name' | 'photo'> }>;
  votes: Vote[];
};

interface SessionDetailClientProps {
  sessionData: SessionWithDetails;
  isMember: boolean;
  userId: string;
}

export function SessionDetailClient({
  sessionData,
  isMember,
  userId,
}: SessionDetailClientProps) {
  const router = useRouter();
  const [isVoting, setIsVoting] = useState(false);

  // Calculate session date and time for display
  const sessionDate = addDays(sessionData.weekDate, sessionData.recurringSlot.dayOfWeek - 1);
  const sessionDateTime = setHours(sessionDate, sessionData.recurringSlot.startHour);
  const formattedDate = format(sessionDateTime, 'EEEE, MMMM d, yyyy');
  const formattedTime = format(sessionDateTime, 'h:mm a');

  const handleVote = async (attending: boolean) => {
    setIsVoting(true);
    try {
      const response = await fetch('/api/votes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionData.id,
          attending,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to record vote');
        return;
      }

      // Refresh the page to show updated vote
      router.refresh();
    } catch (error) {
      console.error('Vote error:', error);
      alert('Failed to record vote. Please try again.');
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="max-w-3xl mx-auto">
        {/* Back button */}
        <Link
          href="/member/schedule"
          className="inline-flex items-center gap-2 text-surface-400 hover:text-surface-100 mb-6"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Schedule
        </Link>

        {/* Session header */}
        <div className="bg-surface-800 rounded-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-surface-100 mb-2">
            {sessionData.workoutTitle || 'Session'}
          </h1>
          <p className="text-surface-400 mb-1">{formattedDate}</p>
          <p className="text-surface-400">{formattedTime}</p>
          {sessionData.status === 'CANCELLED' && (
            <div className="mt-3 inline-block px-3 py-1 bg-error text-white text-sm rounded">
              CANCELLED
            </div>
          )}
        </div>

        {/* Voting prompt (if enabled and member is in session) */}
        {isMember && sessionData.votingEnabled && sessionData.votingDeadline && (
          <div className="mb-6">
            <VotingPrompt
              sessionId={sessionData.id}
              deadline={sessionData.votingDeadline}
              currentVote={sessionData.votes[0]?.attending ?? null}
              onVote={handleVote}
            />
          </div>
        )}

        {/* Workout details */}
        {sessionData.workoutDetails && (
          <div className="bg-surface-800 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-surface-100 mb-4">Workout Details</h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-surface-300 whitespace-pre-wrap">{sessionData.workoutDetails}</p>
            </div>
          </div>
        )}

        {/* Trainers */}
        {sessionData.trainers.length > 0 && (
          <div className="bg-surface-800 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-surface-100 mb-4">Trainers</h2>
            <div className="space-y-2">
              {sessionData.trainers.map((trainer) => (
                <div key={trainer.user.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                    {trainer.user.photo ? (
                      <img
                        src={trainer.user.photo}
                        alt={trainer.user.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-semibold">
                        {trainer.user.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="text-surface-100">{trainer.user.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Group members */}
        {isMember && (
          <div className="bg-surface-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-surface-100 mb-4">
              Group Members ({sessionData.members.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {sessionData.members.map((member) => (
                <div key={member.user.id} className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    {member.user.photo ? (
                      <img
                        src={member.user.photo}
                        alt={member.user.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-white text-xs font-semibold">
                        {member.user.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-surface-300">{member.user.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
