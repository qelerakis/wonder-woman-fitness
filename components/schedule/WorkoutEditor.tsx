'use client';

/**
 * WorkoutEditor Component
 *
 * Allows owner/trainer to edit workout details for a session
 * Inline edit mode with title and details fields
 */

import { useState } from 'react';
import { Session } from '@prisma/client';

interface WorkoutEditorProps {
  session: Pick<Session, 'id' | 'workoutTitle' | 'workoutDetails'>;
  onUpdate: () => void;
}

export function WorkoutEditor({ session, onUpdate }: WorkoutEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState(session.workoutTitle || '');
  const [details, setDetails] = useState(session.workoutDetails || '');

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workoutTitle: title, workoutDetails: details }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save workout');
      }

      setIsEditing(false);
      onUpdate();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save workout');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setTitle(session.workoutTitle || '');
    setDetails(session.workoutDetails || '');
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-surface-100">Workout Details</h3>
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm transition-colors"
          >
            Edit Workout
          </button>
        </div>

        {session.workoutTitle ? (
          <div className="bg-surface-800 rounded-lg p-4">
            <h4 className="font-semibold text-surface-100 mb-2">{session.workoutTitle}</h4>
            <p className="text-surface-300 whitespace-pre-wrap">{session.workoutDetails}</p>
          </div>
        ) : (
          <div className="bg-surface-800 rounded-lg p-4 text-center text-surface-400">
            No workout posted yet
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-surface-100">Edit Workout</h3>

      <div>
        <label className="block text-sm font-medium text-surface-300 mb-2">Workout Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Upper Body Strength"
          className="w-full px-4 py-2 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary"
          disabled={isSaving}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-surface-300 mb-2">
          Workout Details
        </label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={8}
          placeholder="Describe the workout..."
          className="w-full px-4 py-2 bg-surface-800 border border-surface-700 rounded-lg text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          disabled={isSaving}
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? 'Saving...' : 'Save Workout'}
        </button>
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="px-4 py-2 bg-surface-700 hover:bg-surface-600 text-surface-100 rounded-lg disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
