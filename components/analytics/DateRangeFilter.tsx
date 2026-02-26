"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DatePicker } from "@/components/ui/DatePicker";
import { Button } from "@/components/ui/Button";
import { format, subMonths, startOfMonth, endOfMonth, subWeeks, startOfWeek, endOfWeek } from "date-fns";

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onDateChange: (startDate: string, endDate: string) => void;
}

type Preset = "this-month" | "last-month" | "last-3-months" | "this-week" | "last-week";

type PresetKey = "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "last3Months";

const presets: Array<{ key: Preset; labelKey: PresetKey }> = [
  { key: "this-week", labelKey: "thisWeek" },
  { key: "last-week", labelKey: "lastWeek" },
  { key: "this-month", labelKey: "thisMonth" },
  { key: "last-month", labelKey: "lastMonth" },
  { key: "last-3-months", labelKey: "last3Months" },
];

function getPresetDates(preset: Preset): { start: string; end: string } {
  const now = new Date();

  switch (preset) {
    case "this-week": {
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      return {
        start: format(weekStart, "yyyy-MM-dd"),
        end: format(weekEnd, "yyyy-MM-dd"),
      };
    }
    case "last-week": {
      const lastWeek = subWeeks(now, 1);
      const weekStart = startOfWeek(lastWeek, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(lastWeek, { weekStartsOn: 1 });
      return {
        start: format(weekStart, "yyyy-MM-dd"),
        end: format(weekEnd, "yyyy-MM-dd"),
      };
    }
    case "this-month": {
      return {
        start: format(startOfMonth(now), "yyyy-MM-dd"),
        end: format(endOfMonth(now), "yyyy-MM-dd"),
      };
    }
    case "last-month": {
      const lastMonth = subMonths(now, 1);
      return {
        start: format(startOfMonth(lastMonth), "yyyy-MM-dd"),
        end: format(endOfMonth(lastMonth), "yyyy-MM-dd"),
      };
    }
    case "last-3-months": {
      const threeMonthsAgo = subMonths(now, 3);
      return {
        start: format(startOfMonth(threeMonthsAgo), "yyyy-MM-dd"),
        end: format(endOfMonth(now), "yyyy-MM-dd"),
      };
    }
  }
}

export function DateRangeFilter({
  startDate,
  endDate,
  onDateChange,
}: DateRangeFilterProps): React.ReactElement {
  const t = useTranslations("dateRange");
  const [localStart, setLocalStart] = useState(startDate);
  const [localEnd, setLocalEnd] = useState(endDate);

  function handlePreset(preset: Preset): void {
    const { start, end } = getPresetDates(preset);
    setLocalStart(start);
    setLocalEnd(end);
    onDateChange(start, end);
  }

  function handleApply(): void {
    if (localStart && localEnd) {
      onDateChange(localStart, localEnd);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.key}
            onClick={() => handlePreset(preset.key)}
            className="rounded-lg border border-surface-600 px-3 py-1.5 text-xs font-medium text-surface-300 hover:border-primary-600/50 hover:bg-surface-800 hover:text-surface-100 transition-colors"
          >
            {t(preset.labelKey)}
          </button>
        ))}
      </div>

      {/* Custom date inputs */}
      <div className="flex items-end gap-2">
        <DatePicker
          label={t("from")}
          value={localStart}
          onChange={(v) => setLocalStart(v)}
        />
        <DatePicker
          label={t("to")}
          value={localEnd}
          onChange={(v) => setLocalEnd(v)}
        />
        <Button
          variant="secondary"
          size="md"
          onClick={handleApply}
          disabled={!localStart || !localEnd}
        >
          {t("apply")}
        </Button>
      </div>
    </div>
  );
}

export type { DateRangeFilterProps };
