"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DatePicker } from "@/components/ui/DatePicker";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";

interface PaymentRecord {
  id: string;
  amount: number;
  paidAt: Date | string;
  periodStart: Date | string;
  periodEnd: Date | string;
  notes: string | null;
  recordedBy?: {
    name: string;
  };
}

interface PaymentHistoryProps {
  payments: PaymentRecord[];
  showRecordedBy?: boolean;
  editable?: boolean;
  memberName?: string;
  onPaymentChange?: () => void;
}

function formatDate(date: Date | string): string {
  return format(new Date(date), "MMM d, yyyy");
}

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString()} MKD`;
}

export function PaymentHistory({
  payments,
  showRecordedBy = false,
  editable = false,
  memberName,
  onPaymentChange,
}: PaymentHistoryProps): React.ReactElement {
  const t = useTranslations("payments");
  const tv = useTranslations("validation");
  const tc = useTranslations("common");
  const { addToast } = useToast();

  // Edit state
  const [editingPayment, setEditingPayment] = useState<PaymentRecord | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editPaidAt, setEditPaidAt] = useState("");
  const [editPeriodStart, setEditPeriodStart] = useState("");
  const [editPeriodEnd, setEditPeriodEnd] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editLoading, setEditLoading] = useState(false);

  // Delete state
  const [deletingPayment, setDeletingPayment] = useState<PaymentRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  function handleEdit(payment: PaymentRecord): void {
    setEditingPayment(payment);
    setEditAmount(String(payment.amount));
    setEditPaidAt(format(new Date(payment.paidAt), "yyyy-MM-dd'T'HH:mm"));
    setEditPeriodStart(format(new Date(payment.periodStart), "yyyy-MM-dd"));
    setEditPeriodEnd(format(new Date(payment.periodEnd), "yyyy-MM-dd"));
    setEditNotes(payment.notes || "");
    setEditErrors({});
  }

  function closeEdit(): void {
    setEditingPayment(null);
    setEditErrors({});
  }

  async function handleEditSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!editingPayment) return;

    const errors: Record<string, string> = {};
    const parsedAmount = parseFloat(editAmount);
    if (!editAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      errors.amount = tv("positiveAmount");
    }
    if (!editPaidAt) errors.paidAt = tv("required");
    if (!editPeriodStart) errors.periodStart = tv("periodStartRequired");
    if (!editPeriodEnd) errors.periodEnd = tv("required");
    if (editPeriodStart && editPeriodEnd && editPeriodStart > editPeriodEnd) {
      errors.periodEnd = tv("periodEndAfterStart");
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    setEditLoading(true);
    try {
      const res = await fetch(`/api/payments/${editingPayment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsedAmount,
          paidAt: new Date(editPaidAt).toISOString(),
          periodStart: editPeriodStart,
          periodEnd: editPeriodEnd,
          notes: editNotes.trim() || undefined,
        }),
      });

      if (res.ok) {
        addToast({ type: "success", title: "Payment updated" });
        closeEdit();
        onPaymentChange?.();
      } else {
        const data: { error: string } = await res.json();
        addToast({
          type: "error",
          title: t("failedToUpdate"),
          message: data.error,
        });
      }
    } catch {
      addToast({ type: "error", title: tc("networkError") });
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDeleteConfirm(): Promise<void> {
    if (!deletingPayment) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/payments/${deletingPayment.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        addToast({ type: "success", title: "Payment deleted" });
        setDeletingPayment(null);
        onPaymentChange?.();
      } else {
        const data: { error: string } = await res.json();
        addToast({
          type: "error",
          title: t("failedToDelete"),
          message: data.error,
        });
      }
    } catch {
      addToast({ type: "error", title: tc("networkError") });
    } finally {
      setDeleteLoading(false);
    }
  }

  if (payments.length === 0) {
    return (
      <Card>
        <div className="py-8 text-center">
          <svg
            className="mx-auto mb-3 h-10 w-10 text-surface-600"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm text-surface-500">{t("noPayments")}</p>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card padding="none">
        <div className="px-6 py-4">
          <CardHeader title={t("paymentHistory")} />
        </div>
        <div className="divide-y divide-surface-700">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className="flex items-center justify-between gap-4 px-6 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-surface-200">
                  {formatCurrency(payment.amount)}
                </p>
                <p className="text-xs text-surface-400">
                  {formatDate(payment.periodStart)} – {formatDate(payment.periodEnd)}
                </p>
                {payment.notes && (
                  <p className="mt-0.5 text-xs text-surface-500 truncate">
                    {payment.notes}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="shrink-0 text-right">
                  <p className="text-xs text-surface-400">
                    {formatDate(payment.paidAt)}
                  </p>
                  {showRecordedBy && payment.recordedBy && (
                    <p className="text-xs text-surface-500">
                      by {payment.recordedBy.name}
                    </p>
                  )}
                </div>
                {editable && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(payment)}
                      className="rounded p-1 text-surface-500 transition-colors hover:bg-surface-700 hover:text-surface-200"
                      aria-label={t("editPaymentFor", { memberName: formatCurrency(payment.amount) })}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeletingPayment(payment)}
                      className="rounded p-1 text-surface-500 transition-colors hover:bg-error-900/50 hover:text-error-400"
                      aria-label={t("deletePaymentFor", { memberName: formatCurrency(payment.amount) })}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingPayment}
        onClose={closeEdit}
        title={t("editPayment")}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <Input
            label={t("amountMKD")}
            type="number"
            step="1"
            min="1"
            value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
            error={editErrors.amount}
          />
          <DateTimePicker
            label={t("paidAt")}
            value={editPaidAt}
            onChange={(v) => setEditPaidAt(v)}
            error={editErrors.paidAt}
          />
          <div className="grid grid-cols-2 gap-3">
            <DatePicker
              label={t("periodStart")}
              value={editPeriodStart}
              onChange={(v) => setEditPeriodStart(v)}
              error={editErrors.periodStart}
            />
            <DatePicker
              label={t("periodEnd")}
              value={editPeriodEnd}
              onChange={(v) => setEditPeriodEnd(v)}
              error={editErrors.periodEnd}
            />
          </div>
          <Textarea
            label={t("notes")}
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            rows={2}
          />
          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" variant="primary" loading={editLoading}>
              {t("updatePayment")}
            </Button>
            <Button type="button" variant="ghost" onClick={closeEdit}>
              {tc("cancel")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingPayment}
        onClose={() => setDeletingPayment(null)}
        title={t("deletePayment")}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-300">
            {t("deleteConfirmation", {
              amount: deletingPayment ? formatCurrency(deletingPayment.amount) : "",
              memberName: memberName || "",
            })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="danger"
              onClick={handleDeleteConfirm}
              loading={deleteLoading}
            >
              {tc("delete")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setDeletingPayment(null)}
            >
              {tc("cancel")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export type { PaymentHistoryProps, PaymentRecord };
