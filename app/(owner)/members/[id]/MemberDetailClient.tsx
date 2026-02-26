"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { DatePicker } from "@/components/ui/DatePicker";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { Textarea } from "@/components/ui/Textarea";
import { PaymentStatusBadge } from "@/components/payment/PaymentStatusBadge";
import { PaymentHistory } from "@/components/payment/PaymentHistory";
import { useToast } from "@/components/ui/Toast";
import type { PaymentStatus } from "@/lib/constants";

interface MemberData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  photo: string | null;
  status: string;
  joinDate: string;
  trialEndsAt: string | null;
  departedAt: string | null;
  departReason: string | null;
  monthlyRate: number | null;
  overrideActive: boolean;
  paymentStatus: PaymentStatus;
}

interface PaymentData {
  id: string;
  amount: number;
  paidAt: string;
  periodStart: string;
  periodEnd: string;
  notes: string | null;
  recordedBy: { name: string } | null;
}

interface MemberDetailClientProps {
  member: MemberData;
  payments: PaymentData[];
  currentUserId: string;
}

export function MemberDetailClient(
  props: MemberDetailClientProps
): React.ReactElement {
  const { member, payments } = props;
  const router = useRouter();
  const { addToast } = useToast();
  const t = useTranslations("members");
  const tCommon = useTranslations("common");
  const tVal = useTranslations("validation");
  const tPayments = useTranslations("payments");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDepartModal, setShowDepartModal] = useState(false);
  const [showOverrideConfirm, setShowOverrideConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  // Payment form state
  const [payAmount, setPayAmount] = useState(
    member.monthlyRate?.toString() || ""
  );
  const [payDate, setPayDate] = useState(
    format(new Date(), "yyyy-MM-dd'T'HH:mm")
  );
  const [payPeriodStart, setPayPeriodStart] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [payPeriodEnd, setPayPeriodEnd] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payErrors, setPayErrors] = useState<Record<string, string>>({});

  // Depart form state
  const [departReason, setDepartReason] = useState("");

  async function handleRecordPayment(
    e: React.FormEvent
  ): Promise<void> {
    e.preventDefault();
    const errors: Record<string, string> = {};

    const parsedAmount = parseFloat(payAmount);
    if (!payAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      errors.amount = tVal("positiveAmount");
    }
    if (!payDate) errors.paidAt = tVal("paymentDateRequired");
    if (!payPeriodStart) errors.periodStart = tVal("periodStartRequired");
    if (!payPeriodEnd) errors.periodEnd = tVal("periodEndRequired");
    if (payPeriodStart && payPeriodEnd && payPeriodStart > payPeriodEnd) {
      errors.periodEnd = tVal("periodEndAfterStart");
    }

    if (Object.keys(errors).length > 0) {
      setPayErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: member.id,
          amount: parsedAmount,
          paidAt: new Date(payDate).toISOString(),
          periodStart: payPeriodStart,
          periodEnd: payPeriodEnd,
          notes: payNotes.trim() || undefined,
        }),
      });

      if (res.ok) {
        addToast({ type: "success", title: t("paymentRecorded") });
        setShowPaymentModal(false);
        resetPaymentForm();
        router.refresh();
      } else {
        const data: { error: string } = await res.json();
        addToast({
          type: "error",
          title: t("failedToRecordPayment"),
          message: data.error,
        });
      }
    } catch {
      addToast({ type: "error", title: tCommon("networkError") });
    } finally {
      setLoading(false);
    }
  }

  function resetPaymentForm(): void {
    setPayAmount(member.monthlyRate?.toString() || "");
    setPayDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setPayPeriodStart(format(new Date(), "yyyy-MM-dd"));
    setPayPeriodEnd("");
    setPayNotes("");
    setPayErrors({});
  }

  async function handleDepart(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "DEPARTED",
          departReason: departReason.trim() || undefined,
        }),
      });

      if (res.ok) {
        addToast({ type: "success", title: t("memberDeparted") });
        setShowDepartModal(false);
        router.refresh();
      } else {
        addToast({ type: "error", title: t("failedToUpdate") });
      }
    } catch {
      addToast({ type: "error", title: tCommon("networkError") });
    } finally {
      setLoading(false);
    }
  }

  async function handleReactivate(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "ACTIVE",
          departedAt: null,
          departReason: null,
        }),
      });

      if (res.ok) {
        addToast({ type: "success", title: t("memberReactivated") });
        router.refresh();
      } else {
        addToast({ type: "error", title: t("failedToReactivate") });
      }
    } catch {
      addToast({ type: "error", title: tCommon("networkError") });
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleOverride(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrideActive: !member.overrideActive }),
      });

      if (res.ok) {
        addToast({
          type: "success",
          title: member.overrideActive
            ? t("overrideRemoved")
            : t("overrideActivated"),
        });
        setShowOverrideConfirm(false);
        router.refresh();
      } else {
        addToast({ type: "error", title: t("failedToUpdateOverride") });
      }
    } catch {
      addToast({ type: "error", title: tCommon("networkError") });
    } finally {
      setLoading(false);
    }
  }

  async function handleSendReminder(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch(`/api/members/${member.id}/send-reminder`, {
        method: "POST",
      });

      if (res.ok) {
        addToast({ type: "success", title: t("reminderSent") });
      } else {
        addToast({ type: "error", title: t("failedToSendReminder") });
      }
    } catch {
      addToast({ type: "error", title: tCommon("networkError") });
    } finally {
      setLoading(false);
    }
  }

  const isDeparted = member.status === "DEPARTED";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {member.photo ? (
            <Image
              src={member.photo}
              alt=""
              width={64}
              height={64}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-700 text-xl font-bold text-white">
              {member.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-surface-100">
              {member.name}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <PaymentStatusBadge status={member.paymentStatus} />
              {member.overrideActive && (
                <Badge variant="primary" size="sm">
                  {t("overrideActive")}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          {tCommon("back")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          {/* Profile Info */}
          <Card>
            <CardHeader title={t("profileInformation")} />
            <dl className="mt-4 space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-surface-400">{t("email")}</dt>
                <dd className="text-sm text-surface-200">{member.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-surface-400">{t("phone")}</dt>
                <dd className="text-sm text-surface-200">
                  {member.phone || t("notProvided")}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-surface-400">{t("joined")}</dt>
                <dd className="text-sm text-surface-200">
                  {format(new Date(member.joinDate), "MMMM d, yyyy")}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-surface-400">{t("status")}</dt>
                <dd className="text-sm text-surface-200">{member.status}</dd>
              </div>
              {member.monthlyRate !== null && (
                <div className="flex justify-between">
                  <dt className="text-sm text-surface-400">{t("monthlyRate")}</dt>
                  <dd className="text-sm text-surface-200">
                    {member.monthlyRate.toLocaleString()} MKD
                  </dd>
                </div>
              )}
              {member.trialEndsAt && (
                <div className="flex justify-between">
                  <dt className="text-sm text-surface-400">{t("paymentDeadline")}</dt>
                  <dd className="text-sm text-surface-200">
                    {format(new Date(member.trialEndsAt), "MMMM d, yyyy")}
                  </dd>
                </div>
              )}
              {member.departedAt && (
                <div className="flex justify-between">
                  <dt className="text-sm text-surface-400">{t("departed")}</dt>
                  <dd className="text-sm text-surface-200">
                    {format(new Date(member.departedAt), "MMMM d, yyyy")}
                  </dd>
                </div>
              )}
              {member.departReason && (
                <div>
                  <dt className="text-sm text-surface-400 mb-1">
                    {t("departureReason")}
                  </dt>
                  <dd className="text-sm text-surface-300 rounded-lg bg-surface-900/50 px-3 py-2">
                    {member.departReason}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader title={tCommon("actions")} />
            <div className="mt-4 flex flex-wrap gap-2">
              {!isDeparted && (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowPaymentModal(true)}
                  >
                    {t("recordPayment")}
                  </Button>
                  {(member.paymentStatus === "GRACE_PERIOD" ||
                    member.paymentStatus === "LOCKED") && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleSendReminder}
                      loading={loading}
                    >
                      {t("sendReminder")}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowOverrideConfirm(true)}
                  >
                    {member.overrideActive
                      ? t("removeOverride")
                      : t("overrideLockout")}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowDepartModal(true)}
                  >
                    {t("markAsDeparted")}
                  </Button>
                </>
              )}
              {isDeparted && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleReactivate}
                  loading={loading}
                >
                  {t("reactivateMember")}
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Right column — Payment History */}
        <div>
          <PaymentHistory
            payments={payments.map((p) => ({
              ...p,
              recordedBy: p.recordedBy ?? undefined,
            }))}
            showRecordedBy
            editable
            memberName={member.name}
            onPaymentChange={() => router.refresh()}
          />
        </div>
      </div>

      {/* Record Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          resetPaymentForm();
        }}
        title={t("recordPayment")}
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div className="rounded-lg bg-surface-900/50 px-3 py-2">
            <p className="text-sm text-surface-400">
              {t("recordingPaymentFor")}{" "}
              <span className="font-medium text-surface-200">
                {member.name}
              </span>
            </p>
          </div>

          <Input
            label={tPayments("amountMKD")}
            type="number"
            step="1"
            min="1"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            placeholder={tPayments("amountPlaceholder")}
            error={payErrors.amount}
          />

          <DateTimePicker
            label={tPayments("paidAt")}
            value={payDate}
            onChange={(v) => setPayDate(v)}
            error={payErrors.paidAt}
          />

          <div className="grid grid-cols-2 gap-3">
            <DatePicker
              label={tPayments("periodStart")}
              value={payPeriodStart}
              onChange={(v) => setPayPeriodStart(v)}
              error={payErrors.periodStart}
            />
            <DatePicker
              label={tPayments("periodEnd")}
              value={payPeriodEnd}
              onChange={(v) => setPayPeriodEnd(v)}
              error={payErrors.periodEnd}
            />
          </div>

          <Textarea
            label={tPayments("notes")}
            value={payNotes}
            onChange={(e) => setPayNotes(e.target.value)}
            placeholder={tPayments("notesPlaceholder")}
            rows={2}
          />

          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" variant="primary" loading={loading}>
              {t("recordPayment")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowPaymentModal(false);
                resetPaymentForm();
              }}
            >
              {tCommon("cancel")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Mark as Departed Modal */}
      <Modal
        isOpen={showDepartModal}
        onClose={() => setShowDepartModal(false)}
        title={t("markDepartedTitle")}
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-300">
            {t("departedDescription", { name: member.name })}
          </p>

          <Textarea
            label={t("departReasonLabel")}
            value={departReason}
            onChange={(e) => setDepartReason(e.target.value)}
            placeholder={t("departReasonPlaceholder")}
            rows={3}
          />

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="danger"
              onClick={handleDepart}
              loading={loading}
            >
              {t("markAsDeparted")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowDepartModal(false)}
            >
              {tCommon("cancel")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Override Confirm Modal */}
      <Modal
        isOpen={showOverrideConfirm}
        onClose={() => setShowOverrideConfirm(false)}
        title={
          member.overrideActive
            ? t("removePaymentOverride")
            : t("activatePaymentOverride")
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-300">
            {member.overrideActive
              ? t("removeOverrideDescription", { name: member.name })
              : t("activateOverrideDescription", { name: member.name })}
          </p>

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant={member.overrideActive ? "danger" : "primary"}
              onClick={handleToggleOverride}
              loading={loading}
            >
              {member.overrideActive
                ? t("removeOverride")
                : t("activateOverride")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowOverrideConfirm(false)}
            >
              {tCommon("cancel")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
