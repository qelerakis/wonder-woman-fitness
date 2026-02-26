"use client";

import { useState } from "react";
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
  const tVal = useTranslations("validation");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Create form state
  const [trainerName, setTrainerName] = useState("");
  const [trainerEmail, setTrainerEmail] = useState("");
  const [trainerPhone, setTrainerPhone] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  function resetForm(): void {
    setTrainerName("");
    setTrainerEmail("");
    setTrainerPhone("");
    setFormErrors({});
  }

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!trainerName.trim()) errors.name = tVal("nameRequired");
    if (!trainerEmail.trim()) errors.email = tVal("emailRequired");
    if (trainerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trainerEmail)) {
      errors.email = tVal("invalidEmailFormat");
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/trainers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trainerName.trim(),
          email: trainerEmail.trim(),
          phone: trainerPhone.trim() || undefined,
        }),
      });

      if (res.ok) {
        addToast({
          type: "success",
          title: t("trainerCreated"),
          message: t("trainerCreatedMessage"),
        });
        setShowCreateModal(false);
        resetForm();
        router.refresh();
      } else {
        const data: { error: string } = await res.json();
        addToast({
          type: "error",
          title: t("failedToCreate"),
          message: data.error,
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
          onClick={() => setShowCreateModal(true)}
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
                      {trainer.phone || "—"}
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

      {/* Create Trainer Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        title={t("addTrainer")}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <p className="text-sm text-surface-400">
            {t("tempPasswordNote")}
          </p>

          <Input
            label={t("fullName")}
            value={trainerName}
            onChange={(e) => setTrainerName(e.target.value)}
            placeholder={t("fullNamePlaceholder")}
            error={formErrors.name}
          />

          <Input
            label={t("email")}
            type="email"
            value={trainerEmail}
            onChange={(e) => setTrainerEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            error={formErrors.email}
          />

          <Input
            label={t("phoneOptional")}
            value={trainerPhone}
            onChange={(e) => setTrainerPhone(e.target.value)}
            placeholder={t("phonePlaceholder")}
          />

          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" variant="primary" loading={loading}>
              {t("addTrainer")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
            >
              {tCommon("cancel")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
