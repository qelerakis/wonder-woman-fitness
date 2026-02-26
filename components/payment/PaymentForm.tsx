"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/Input";
import { DatePicker } from "@/components/ui/DatePicker";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { format } from "date-fns";

interface PaymentFormProps {
  memberId: string;
  memberName: string;
  onSubmit: (data: PaymentFormData) => Promise<void>;
  onCancel?: () => void;
  initialData?: Partial<PaymentFormData>;
}

interface PaymentFormData {
  userId: string;
  amount: number;
  paidAt: string;
  periodStart: string;
  periodEnd: string;
  notes?: string;
}

export function PaymentForm({
  memberId,
  memberName,
  onSubmit,
  onCancel,
  initialData,
}: PaymentFormProps): React.ReactElement {
  const t = useTranslations("payments");
  const tv = useTranslations("validation");
  const tc = useTranslations("common");
  const today = format(new Date(), "yyyy-MM-dd");
  const todayDatetime = format(new Date(), "yyyy-MM-dd'T'HH:mm");

  const [amount, setAmount] = useState(initialData?.amount?.toString() || "");
  const [paidAt, setPaidAt] = useState(initialData?.paidAt || todayDatetime);
  const [periodStart, setPeriodStart] = useState(initialData?.periodStart || today);
  const [periodEnd, setPeriodEnd] = useState(initialData?.periodEnd || "");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      newErrors.amount = tv("positiveAmount");
    }
    if (!paidAt) {
      newErrors.paidAt = tv("required");
    }
    if (!periodStart) {
      newErrors.periodStart = tv("periodStartRequired");
    }
    if (!periodEnd) {
      newErrors.periodEnd = tv("required");
    }
    if (periodStart && periodEnd && periodStart > periodEnd) {
      newErrors.periodEnd = tv("periodEndAfterStart");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      await onSubmit({
        userId: memberId,
        amount: parseFloat(amount),
        paidAt: new Date(paidAt).toISOString(),
        periodStart,
        periodEnd,
        notes: notes.trim() || undefined,
      });
    } catch {
      setErrors({ form: t("failedToRecord") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg bg-surface-900/50 px-3 py-2 mb-4">
        <p className="text-sm text-surface-400">
          Recording payment for{" "}
          <span className="font-medium text-surface-200">{memberName}</span>
        </p>
      </div>

      <Input
        label={t("amountMKD")}
        type="number"
        step="1"
        min="1"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={t("amountPlaceholder")}
        error={errors.amount}
      />

      <DateTimePicker
        label={t("paidAt")}
        value={paidAt}
        onChange={(v) => setPaidAt(v)}
        error={errors.paidAt}
      />

      <div className="grid grid-cols-2 gap-3">
        <DatePicker
          label={t("periodStart")}
          value={periodStart}
          onChange={(v) => setPeriodStart(v)}
          error={errors.periodStart}
        />
        <DatePicker
          label={t("periodEnd")}
          value={periodEnd}
          onChange={(v) => setPeriodEnd(v)}
          error={errors.periodEnd}
        />
      </div>

      <Textarea
        label={t("notes")}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={t("notesPlaceholder")}
        rows={2}
      />

      {errors.form && (
        <p className="text-sm text-error-500" role="alert">
          {errors.form}
        </p>
      )}

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" variant="primary" loading={saving}>
          {initialData ? t("updatePayment") : t("recordPayment")}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {tc("cancel")}
          </Button>
        )}
      </div>
    </form>
  );
}

export type { PaymentFormProps, PaymentFormData };
