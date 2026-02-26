"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";

interface WorkoutEditorProps {
  sessionId: string;
  initialTitle: string;
  initialDetails: string;
  onSave: (sessionId: string, title: string, details: string) => Promise<void>;
  onCancel?: () => void;
}

export function WorkoutEditor({
  sessionId,
  initialTitle,
  initialDetails,
  onSave,
  onCancel,
}: WorkoutEditorProps): React.ReactElement {
  const t = useTranslations("workout");
  const tc = useTranslations("common");
  const [title, setTitle] = useState(initialTitle);
  const [details, setDetails] = useState(initialDetails);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanges = title !== initialTitle || details !== initialDetails;

  async function handleSave(): Promise<void> {
    if (!title.trim()) {
      setError("Workout title is required");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave(sessionId, title.trim(), details.trim());
    } catch {
      setError(t("failedToSave"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-surface-700 bg-surface-800 p-4">
      <h4 className="text-sm font-semibold text-surface-200 mb-3">
        Edit Workout
      </h4>

      <div className="space-y-3">
        <Input
          label="Workout Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., HIIT Strength Circuit"
          error={error && !title.trim() ? error : undefined}
        />

        <Textarea
          label="Workout Details"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Describe the workout exercises, sets, reps, etc."
          rows={5}
        />

        {error && title.trim() && (
          <p className="text-sm text-error-500">{error}</p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            loading={saving}
            disabled={!hasChanges}
          >
            Save Workout
          </Button>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              {tc("cancel")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export type { WorkoutEditorProps };
