'use client';

/**
 * SessionDetailModal Component
 *
 * Modal dialog for viewing and editing session details
 * Tabs: Workout, Members, Voting
 */

import { useState } from 'react';
import { Session, RecurringSlot, User } from '@prisma/client';
import { WorkoutEditor } from './WorkoutEditor';
import { VoteSummary } from './VoteSummary';

type SessionWithDetails = Session & {
  recurringSlot: RecurringSlot;
  members: Array<{ user: Pick<User, 'id' | 'name' | 'photo'> }>;
  trainers: Array<{ user: Pick<User, 'id' | 'name' | 'photo'> }>;
  votes?: Array<{ userId: string; attending: boolean; user: { id: string; name: string; photo: string | null } }>;
};

interface SessionDetailModalProps {
  session: SessionWithDetails;
  onClose: () => void;
  onUpdate: () => void;
}

export function SessionDetailModal({ session, onClose, onUpdate }: SessionDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'workout' | 'members' | 'voting'>('workout');

  // Format session time
  const sessionTime = new Date();
  sessionTime.setHours(session.recurringSlot.startHour, 0, 0, 0);
  const timeString = sessionTime.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-surface-900 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-surface-800 border-b border-surface-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-surface-100">
                {session.workoutTitle || 'Session Details'}
              </h2>
              <p className="text-surface-400 text-sm">
                {timeString}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-surface-400 hover:text-surface-100 transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-4">
            <button
              onClick={() => setActiveTab('workout')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'workout'
                  ? 'bg-primary text-white'
                  : 'text-surface-400 hover:text-surface-100'
              }`}
            >
              Workout
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === 'members'
                  ? 'bg-primary text-white'
                  : 'text-surface-400 hover:text-surface-100'
              }`}
            >
              Members ({session.members.length})
            </button>
            {session.votingEnabled && (
              <button
                onClick={() => setActiveTab('voting')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'voting'
                    ? 'bg-primary text-white'
                    : 'text-surface-400 hover:text-surface-100'
                }`}
              >
                Voting
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {activeTab === 'workout' && (
            <WorkoutEditor session={session} onUpdate={onUpdate} />
          )}

          {activeTab === 'members' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-surface-100">
                Assigned Members ({session.members.length}/20)
              </h3>
              {session.members.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {session.members.map((member) => (
                    <div
                      key={member.user.id}
                      className="flex items-center justify-between bg-surface-800 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center overflow-hidden">
                          {member.user.photo ? (
                            <img
                              src={member.user.photo}
                              alt={member.user.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-white font-semibold">
                              {member.user.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span className="text-surface-100">{member.user.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-surface-800 rounded-lg p-8 text-center text-surface-400">
                  No members assigned to this session yet
                </div>
              )}
            </div>
          )}

          {activeTab === 'voting' && session.votingEnabled && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-surface-100 mb-4">Voting Results</h3>
              <VoteSummary
                votes={session.votes || []}
                totalMembers={session.members.length}
                showDetails={true}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
