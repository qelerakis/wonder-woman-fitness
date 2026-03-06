"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

interface TrainerData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  createdAt: string;
}

interface MemberOption {
  id: string;
  name: string;
  email: string;
  status: string;
}

interface TrainersClientProps {
  trainers: TrainerData[];
}

export function TrainersClient({
  trainers,
}: TrainersClientProps): React.ReactElement {
  const router = useRouter();
  const { addToast } = useToast();
  const t = useTranslations("trainers");
  const tCommon = useTranslations("common");
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<MemberOption | null>(
    null
  );
  const [showConfirm, setShowConfirm] = useState(false);

  const fetchMembers = useCallback(() => {
    setLoadingMembers(true);
    fetch("/api/members")
      .then((res) => res.json())
      .then((data: { data: MemberOption[] }) => {
        const active = data.data.filter(
          (m: MemberOption) => m.status !== "DEPARTED"
        );
        setMembers(active);
      })
      .catch(() => {
        addToast({ type: "error", title: tCommon("networkError") });
      })
      .finally(() => setLoadingMembers(false));
    // addToast and tCommon are stable refs from context/next-intl
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch members when modal opens
  useEffect(() => {
    if (!showModal) return;
    fetchMembers();
  }, [showModal, fetchMembers]);

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [members, search]);

  function resetModal(): void {
    setSearch("");
    setSelectedMember(null);
    setShowConfirm(false);
    setMembers([]);
  }

  function handleClose(): void {
    setShowModal(false);
    resetModal();
  }

  function handleSelectMember(member: MemberOption): void {
    setSelectedMember(member);
    setShowConfirm(true);
  }

  function handleBackToList(): void {
    setSelectedMember(null);
    setShowConfirm(false);
  }

  async function handlePromote(): Promise<void> {
    if (!selectedMember) return;
    setLoading(true);
    try {
      const res = await fetch("/api/trainers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: selectedMember.id }),
      });

      if (res.ok) {
        addToast({
          type: "success",
          title: t("trainerCreated"),
          message: t("trainerCreatedMessage", { name: selectedMember.name }),
        });
        handleClose();
        router.refresh();
      } else {
        const data: { error?: string } = await res.json();
        addToast({
          type: "error",
          title: t("failedToCreate"),
          message: typeof data.error === "string" ? data.error : t("failedToCreate"),
        });
      }
    } catch {
      addToast({ type: "error", title: tCommon("networkError") });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">{t("title")}</h1>
          <p className="mt-1 text-sm text-surface-400">
            {t("count", { count: trainers.length })}
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowModal(true)}
        >
          {t("addTrainer")}
        </Button>
      </div>

      {/* Trainers list */}
      {trainers.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <svg
              className="mx-auto mb-3 h-10 w-10 text-surface-600"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
            <p className="text-sm text-surface-500">{t("noTrainers")}</p>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-700 text-left">
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500">
                    {t("name")}
                  </th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500">
                    {t("email")}
                  </th>
                  <th className="hidden px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500 sm:table-cell">
                    {t("phone")}
                  </th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500">
                    {t("status")}
                  </th>
                  <th className="hidden px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500 md:table-cell">
                    {t("added")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/50">
                {trainers.map((trainer) => (
                  <tr
                    key={trainer.id}
                    className="transition-colors hover:bg-surface-800/80"
                  >
                    <td className="px-6 py-3">
                      <p className="text-sm font-medium text-surface-200">
                        {trainer.name}
                      </p>
                    </td>
                    <td className="px-6 py-3 text-sm text-surface-400">
                      {trainer.email}
                    </td>
                    <td className="hidden px-6 py-3 text-sm text-surface-400 sm:table-cell">
                      {trainer.phone || "\u2014"}
                    </td>
                    <td className="px-6 py-3">
                      <Badge
                        variant={
                          trainer.status === "ACTIVE" ? "success" : "default"
                        }
                        size="sm"
                      >
                        {trainer.status}
                      </Badge>
                    </td>
                    <td className="hidden px-6 py-3 text-sm text-surface-500 md:table-cell">
                      {format(new Date(trainer.createdAt), "MMM d, yyyy")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Promote Member Modal */}
      <Modal isOpen={showModal} onClose={handleClose} title={t("addTrainer")}>
        {showConfirm && selectedMember ? (
          /* Confirmation step */
          <div className="space-y-4">
            <p className="text-sm font-medium text-surface-200">
              {t("confirmPromote", { name: selectedMember.name })}
            </p>
            <p className="text-sm text-surface-400">
              {t("confirmPromoteMessage")}
            </p>
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="primary"
                loading={loading}
                onClick={handlePromote}
              >
                {t("promote")}
              </Button>
              <Button variant="ghost" onClick={handleBackToList}>
                {tCommon("cancel")}
              </Button>
            </div>
          </div>
        ) : (
          /* Member selection step */
          <div className="space-y-4">
            <p className="text-sm text-surface-400">{t("selectMember")}</p>
            <Input
              placeholder={t("searchMembers")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {loadingMembers ? (
              <p className="py-4 text-center text-sm text-surface-500">
                {t("loadingMembers")}
              </p>
            ) : filteredMembers.length === 0 ? (
              <p className="py-4 text-center text-sm text-surface-500">
                {t("noMembers")}
              </p>
            ) : (
              <div className="max-h-60 overflow-y-auto rounded-lg border border-surface-700">
                {filteredMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className="flex w-full items-center justify-between border-b border-surface-700/50 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-800/80"
                    onClick={() => handleSelectMember(member)}
                  >
                    <div>
                      <p className="text-sm font-medium text-surface-200">
                        {member.name}
                      </p>
                      <p className="text-xs text-surface-400">{member.email}</p>
                    </div>
                    <Badge
                      variant={
                        member.status === "ACTIVE" ? "success" : "default"
                      }
                      size="sm"
                    >
                      {member.status}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 pt-2">
              <Button variant="ghost" onClick={handleClose}>
                {tCommon("cancel")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
