"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

interface AssignmentToggleListProps {
  title: string;
  people: Array<{ id: string; name: string }>;
  assignedIds: string[];
  onToggle: (userId: string, currentlyAssigned: boolean) => Promise<void>;
  disabled?: boolean;
  maxCapacity?: number;
  currentCount?: number;
  showSearch?: boolean;
}

export function AssignmentToggleList({
  title,
  people,
  assignedIds,
  onToggle,
  disabled = false,
  maxCapacity,
  currentCount,
  showSearch = false,
}: AssignmentToggleListProps): React.ReactElement {
  const t = useTranslations("assignment");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const atCapacity =
    maxCapacity !== undefined &&
    currentCount !== undefined &&
    currentCount >= maxCapacity;

  const capacityDescription =
    maxCapacity !== undefined && currentCount !== undefined
      ? `${currentCount} / ${maxCapacity}`
      : undefined;

  const filteredPeople = showSearch && searchQuery.trim()
    ? people.filter((person) =>
        person.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : people;

  async function handleToggle(
    userId: string,
    currentlyAssigned: boolean
  ): Promise<void> {
    setLoadingId(userId);
    try {
      await onToggle(userId, currentlyAssigned);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <Card padding="sm">
      <CardHeader title={title} description={capacityDescription} />

      {showSearch && (
        <div className="mt-3 px-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-surface-100 placeholder-surface-500 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>
      )}

      <div className="mt-3 flex flex-col gap-1.5">
        {filteredPeople.length === 0 && (
          <p className="px-3 py-2 text-sm text-surface-500">
            {showSearch && searchQuery.trim() ? t("noSearchResults") : t("noPeopleAvailable")}
          </p>
        )}

        {filteredPeople.map((person) => {
          const isAssigned = assignedIds.includes(person.id);
          const isLoading = loadingId === person.id;
          const isAddDisabled = disabled || (!isAssigned && atCapacity);
          const isRemoveDisabled = disabled;

          return (
            <div
              key={person.id}
              className={`flex items-center justify-between rounded-lg bg-surface-900/50 px-3 py-2 ${
                isAssigned ? "border-l-2 border-success-500" : ""
              }`}
            >
              <span
                className={`text-sm ${
                  isAssigned
                    ? "font-medium text-surface-100"
                    : "text-surface-400"
                }`}
              >
                {person.name}
              </span>

              {isLoading ? (
                <div className="flex h-[30px] w-[82px] items-center justify-center">
                  <Spinner size="sm" />
                </div>
              ) : isAssigned ? (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isRemoveDisabled}
                  onClick={() => handleToggle(person.id, true)}
                >
                  {t("assigned")}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isAddDisabled}
                  onClick={() => handleToggle(person.id, false)}
                >
                  {t("add")}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
