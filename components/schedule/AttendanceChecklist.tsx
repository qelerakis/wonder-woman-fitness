"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

interface AttendanceMember {
  userId: string;
  name: string;
  present: boolean | null;
}

interface AttendanceChecklistProps {
  sessionId: string;
  members: AttendanceMember[];
  allActiveMembers: Array<{ id: string; name: string }>;
}

export function AttendanceChecklist({
  sessionId,
  members: initialMembers,
  allActiveMembers,
}: AttendanceChecklistProps): React.ReactElement {
  const t = useTranslations("attendance");
  const [members, setMembers] = useState<AttendanceMember[]>(initialMembers);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const { addToast } = useToast();

  const presentCount = members.filter((m) => m.present === true).length;
  const totalCount = members.length;

  async function handleToggle(userId: string): Promise<void> {
    const memberIndex = members.findIndex((m) => m.userId === userId);
    if (memberIndex === -1) return;

    const member = members[memberIndex];
    const previousPresent = member.present;
    const newPresent = previousPresent === true ? false : true;

    // Optimistic update
    setMembers((prev) =>
      prev.map((m) =>
        m.userId === userId ? { ...m, present: newPresent } : m
      )
    );

    try {
      const res = await fetch(`/api/sessions/${sessionId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, present: newPresent }),
      });

      if (!res.ok) {
        // Rollback
        setMembers((prev) =>
          prev.map((m) =>
            m.userId === userId ? { ...m, present: previousPresent } : m
          )
        );
        addToast({
          type: "error",
          title: t("failedToUpdate"),
        });
      }
    } catch {
      // Rollback on network error
      setMembers((prev) =>
        prev.map((m) =>
          m.userId === userId ? { ...m, present: previousPresent } : m
        )
      );
      addToast({
        type: "error",
        title: "Failed to update attendance",
      });
    }
  }

  const availableMembers = allActiveMembers.filter(
    (am) => !members.some((m) => m.userId === am.id)
  );

  async function handleAddMember(userId: string, name: string): Promise<void> {
    try {
      // First add member to session
      const addRes = await fetch(`/api/sessions/${sessionId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "add" }),
      });

      if (!addRes.ok) {
        addToast({
          type: "error",
          title: t("failedToAddMember"),
        });
        return;
      }

      // Then mark attendance as present
      const attendanceRes = await fetch(
        `/api/sessions/${sessionId}/attendance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, present: true }),
        }
      );

      if (!attendanceRes.ok) {
        addToast({
          type: "error",
          title: t("failedToMark"),
        });
        return;
      }

      // Add to local state as present
      setMembers((prev) => [...prev, { userId, name, present: true }]);
      setShowAddDropdown(false);

      addToast({
        type: "success",
        title: t("memberAddedAndPresent", { name }),
      });
    } catch {
      addToast({
        type: "error",
        title: t("failedToAdd"),
      });
    }
  }

  return (
    <Card padding="sm">
      <CardHeader
        title={t("title")}
        description={t("presentCount", { presentCount, totalCount })}
      />

      <div className="mt-3 flex flex-col gap-1.5">
        {members.map((member) => {
          const isPresent = member.present === true;

          return (
            <button
              key={member.userId}
              data-testid={`attendance-row-${member.userId}`}
              onClick={() => handleToggle(member.userId)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                isPresent
                  ? "bg-success-500/10 hover:bg-success-500/20"
                  : "bg-surface-900/50 hover:bg-surface-700"
              }`}
            >
              {/* Circle indicator */}
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                  isPresent
                    ? "border-success-500 bg-success-500"
                    : "border-surface-500"
                }`}
              >
                {isPresent && (
                  <svg
                    className="h-3.5 w-3.5 text-white"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>

              {/* Member name */}
              <span
                className={`text-sm ${
                  isPresent
                    ? "font-medium text-surface-100"
                    : "text-surface-400"
                }`}
              >
                {member.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Add Member section */}
      <div className="mt-3 border-t border-surface-700 pt-3">
        {!showAddDropdown ? (
          <button
            onClick={() => setShowAddDropdown(true)}
            className="flex w-full items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm text-primary-400 transition-colors hover:bg-surface-700"
          >
            + Add Member
          </button>
        ) : (
          <div className="flex flex-col gap-1">
            {availableMembers.length === 0 ? (
              <p className="px-3 py-2 text-center text-sm text-surface-500">
                {t("noPeopleAvailable")}
              </p>
            ) : (
              availableMembers.map((am) => (
                <button
                  key={am.id}
                  onClick={() => handleAddMember(am.id, am.name)}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm text-surface-300 transition-colors hover:bg-surface-700"
                >
                  {am.name}
                </button>
              ))
            )}
            <button
              onClick={() => setShowAddDropdown(false)}
              className="mt-1 flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm text-surface-400 transition-colors hover:bg-surface-700"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

export type { AttendanceChecklistProps, AttendanceMember };
