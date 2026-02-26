"use client";

import { useTranslations } from "next-intl";

interface WorkoutDisplayProps {
  title: string | null;
  details: string | null;
}

export function WorkoutDisplay({
  title,
  details,
}: WorkoutDisplayProps): React.ReactElement {
  const t = useTranslations("workout");

  if (!title && !details) {
    return (
      <div className="rounded-lg border border-dashed border-surface-700 p-4 text-center">
        <p className="text-sm text-surface-500">
          {t("noWorkout")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-surface-700 bg-surface-800 p-4">
      {title && (
        <h4 className="text-base font-semibold text-surface-100 mb-2">
          {title}
        </h4>
      )}
      {details && (
        <div className="prose prose-sm prose-invert max-w-none">
          {details.split("\n").map((line, i) => (
            <p key={i} className="text-sm text-surface-300 mb-1 last:mb-0">
              {line || "\u00A0"}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export type { WorkoutDisplayProps };
