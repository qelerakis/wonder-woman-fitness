"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { format } from "date-fns";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { PaymentStatusBadge } from "@/components/payment/PaymentStatusBadge";
import { PaymentHistory } from "@/components/payment/PaymentHistory";
import { TrialBadge } from "@/components/member/TrialBadge";
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
      errors.amount = "Amount must be a positive number";
    }
    if (!payDate) errors.paidAt = "Payment date is required";
    if (!payPeriodStart) errors.periodStart = "Period start is required";
    if (!payPeriodEnd) errors.periodEnd = "Period end is required";
    if (payPeriodStart && payPeriodEnd && payPeriodStart > payPeriodEnd) {
      errors.periodEnd = "Period end must be after start";
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
        addToast({ type: "success", title: "Payment recorded" });
        setShowPaymentModal(false);
        resetPaymentForm();
        router.refresh();
      } else {
        const data: { error: string } = await res.json();
        addToast({
          type: "error",
          title: "Failed to record payment",
          message: data.error,
        });
      }
    } catch {
      addToast({ type: "error", title: "Network error" });
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
        addToast({ type: "success", title: "Member marked as departed" });
        setShowDepartModal(false);
        router.refresh();
      } else {
        addToast({ type: "error", title: "Failed to update member" });
      }
    } catch {
      addToast({ type: "error", title: "Network error" });
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
        addToast({ type: "success", title: "Member reactivated" });
        router.refresh();
      } else {
        addToast({ type: "error", title: "Failed to reactivate member" });
      }
    } catch {
      addToast({ type: "error", title: "Network error" });
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
            ? "Override removed"
            : "Override activated",
        });
        setShowOverrideConfirm(false);
        router.refresh();
      } else {
        addToast({ type: "error", title: "Failed to update override" });
      }
    } catch {
      addToast({ type: "error", title: "Network error" });
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
        addToast({ type: "success", title: "Payment reminder sent" });
      } else {
        addToast({ type: "error", title: "Failed to send reminder" });
      }
    } catch {
      addToast({ type: "error", title: "Network error" });
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
              {member.status === "TRIAL" && member.trialEndsAt && (
                <TrialBadge trialEndsAt={member.trialEndsAt} />
              )}
              {member.overrideActive && (
                <Badge variant="primary" size="sm">
                  Override Active
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          Back
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          {/* Profile Info */}
          <Card>
            <CardHeader title="Profile Information" />
            <dl className="mt-4 space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-surface-400">Email</dt>
                <dd className="text-sm text-surface-200">{member.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-surface-400">Phone</dt>
                <dd className="text-sm text-surface-200">
                  {member.phone || "Not provided"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-surface-400">Joined</dt>
                <dd className="text-sm text-surface-200">
                  {format(new Date(member.joinDate), "MMMM d, yyyy")}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-surface-400">Status</dt>
                <dd className="text-sm text-surface-200">{member.status}</dd>
              </div>
              {member.monthlyRate !== null && (
                <div className="flex justify-between">
                  <dt className="text-sm text-surface-400">Monthly Rate</dt>
                  <dd className="text-sm text-surface-200">
                    {member.monthlyRate.toLocaleString()} MKD
                  </dd>
                </div>
              )}
              {member.trialEndsAt && (
                <div className="flex justify-between">
                  <dt className="text-sm text-surface-400">Trial Ends</dt>
                  <dd className="text-sm text-surface-200">
                    {format(new Date(member.trialEndsAt), "MMMM d, yyyy")}
                  </dd>
                </div>
              )}
              {member.departedAt && (
                <div className="flex justify-between">
                  <dt className="text-sm text-surface-400">Departed</dt>
                  <dd className="text-sm text-surface-200">
                    {format(new Date(member.departedAt), "MMMM d, yyyy")}
                  </dd>
                </div>
              )}
              {member.departReason && (
                <div>
                  <dt className="text-sm text-surface-400 mb-1">
                    Departure Reason
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
            <CardHeader title="Actions" />
            <div className="mt-4 flex flex-wrap gap-2">
              {!isDeparted && (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowPaymentModal(true)}
                  >
                    Record Payment
                  </Button>
                  {(member.paymentStatus === "GRACE_PERIOD" ||
                    member.paymentStatus === "LOCKED") && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleSendReminder}
                      loading={loading}
                    >
                      Send Reminder
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowOverrideConfirm(true)}
                  >
                    {member.overrideActive
                      ? "Remove Override"
                      : "Override Lockout"}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowDepartModal(true)}
                  >
                    Mark as Departed
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
                  Reactivate Member
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
        title="Record Payment"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div className="rounded-lg bg-surface-900/50 px-3 py-2">
            <p className="text-sm text-surface-400">
              Recording payment for{" "}
              <span className="font-medium text-surface-200">
                {member.name}
              </span>
            </p>
          </div>

          <Input
            label="Amount (MKD)"
            type="number"
            step="1"
            min="1"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            placeholder="e.g., 1500"
            error={payErrors.amount}
          />

          <Input
            label="Paid At"
            type="datetime-local"
            value={payDate}
            onChange={(e) => setPayDate(e.target.value)}
            error={payErrors.paidAt}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Period Start"
              type="date"
              value={payPeriodStart}
              onChange={(e) => setPayPeriodStart(e.target.value)}
              error={payErrors.periodStart}
            />
            <Input
              label="Period End"
              type="date"
              value={payPeriodEnd}
              onChange={(e) => setPayPeriodEnd(e.target.value)}
              error={payErrors.periodEnd}
            />
          </div>

          <Textarea
            label="Notes (optional)"
            value={payNotes}
            onChange={(e) => setPayNotes(e.target.value)}
            placeholder="Any additional notes..."
            rows={2}
          />

          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" variant="primary" loading={loading}>
              Record Payment
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowPaymentModal(false);
                resetPaymentForm();
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      {/* Mark as Departed Modal */}
      <Modal
        isOpen={showDepartModal}
        onClose={() => setShowDepartModal(false)}
        title="Mark Member as Departed"
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-300">
            This will mark{" "}
            <span className="font-medium text-surface-100">{member.name}</span>{" "}
            as departed. They will lose access to the schedule and sessions.
            Their historical data will be preserved.
          </p>

          <Textarea
            label="Reason (optional)"
            value={departReason}
            onChange={(e) => setDepartReason(e.target.value)}
            placeholder="Why is this member leaving?"
            rows={3}
          />

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="danger"
              onClick={handleDepart}
              loading={loading}
            >
              Mark as Departed
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowDepartModal(false)}
            >
              Cancel
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
            ? "Remove Payment Override"
            : "Activate Payment Override"
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-300">
            {member.overrideActive
              ? `This will remove the payment override for ${member.name}. Their payment status will be computed normally, and they may be locked out if they have outstanding payments.`
              : `This will activate a payment override for ${member.name}. They will have full access regardless of their payment status.`}
          </p>

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant={member.overrideActive ? "danger" : "primary"}
              onClick={handleToggleOverride}
              loading={loading}
            >
              {member.overrideActive
                ? "Remove Override"
                : "Activate Override"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowOverrideConfirm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
