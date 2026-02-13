"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { PaymentStatusBadge } from "@/components/payment/PaymentStatusBadge";
import { useToast } from "@/components/ui/Toast";
import type { PaymentStatus } from "@/lib/constants";

interface PaymentItem {
  id: string;
  amount: number;
  paidAt: string;
  periodStart: string;
  periodEnd: string;
  notes: string | null;
  memberName: string;
  memberId: string;
  recordedBy: string | null;
}

interface MemberStatus {
  id: string;
  name: string;
  paymentStatus: PaymentStatus;
}

interface PaymentsSummary {
  totalRevenue: number;
  thisMonthRevenue: number;
  paidCount: number;
  unpaidCount: number;
  totalMembers: number;
}

interface PaymentsClientProps {
  payments: PaymentItem[];
  members: MemberStatus[];
  summary: PaymentsSummary;
  currentUserId: string;
}

export function PaymentsClient(
  props: PaymentsClientProps
): React.ReactElement {
  const { payments, members, summary } = props;
  const router = useRouter();
  const { addToast } = useToast();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Payment form state
  const [selectedMember, setSelectedMember] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(
    format(new Date(), "yyyy-MM-dd'T'HH:mm")
  );
  const [payPeriodStart, setPayPeriodStart] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [payPeriodEnd, setPayPeriodEnd] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payErrors, setPayErrors] = useState<Record<string, string>>({});

  function resetForm(): void {
    setSelectedMember("");
    setPayAmount("");
    setPayDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setPayPeriodStart(format(new Date(), "yyyy-MM-dd"));
    setPayPeriodEnd("");
    setPayNotes("");
    setPayErrors({});
  }

  async function handleRecordPayment(
    e: React.FormEvent
  ): Promise<void> {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!selectedMember) errors.member = "Select a member";
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
          userId: selectedMember,
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
        resetForm();
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

  function formatCurrency(amount: number): string {
    return `${amount.toLocaleString()} MKD`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">Payments</h1>
          <p className="mt-1 text-sm text-surface-400">
            Track and record member payments
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowPaymentModal(true)}
        >
          Record Payment
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">
            This Month
          </p>
          <p className="mt-1 text-xl font-bold text-surface-100">
            {formatCurrency(summary.thisMonthRevenue)}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">
            All Time
          </p>
          <p className="mt-1 text-xl font-bold text-surface-100">
            {formatCurrency(summary.totalRevenue)}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">
            Paid Members
          </p>
          <p className="mt-1 text-xl font-bold text-success-400">
            {summary.paidCount}
            <span className="text-sm font-normal text-surface-500">
              {" "}
              / {summary.totalMembers}
            </span>
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">
            Unpaid
          </p>
          <p
            className={`mt-1 text-xl font-bold ${
              summary.unpaidCount > 0 ? "text-error-400" : "text-surface-100"
            }`}
          >
            {summary.unpaidCount}
          </p>
        </Card>
      </div>

      {/* Unpaid members quick list */}
      {members.some(
        (m) =>
          m.paymentStatus === "GRACE_PERIOD" ||
          m.paymentStatus === "LOCKED"
      ) && (
        <Card>
          <CardHeader
            title="Unpaid Members"
            description="Members with outstanding payments"
          />
          <div className="mt-3 space-y-2">
            {members
              .filter(
                (m) =>
                  m.paymentStatus === "GRACE_PERIOD" ||
                  m.paymentStatus === "LOCKED"
              )
              .map((m) => (
                <Link
                  key={m.id}
                  href={`/members/${m.id}`}
                  className="flex items-center justify-between rounded-lg bg-surface-900/50 px-3 py-2 transition-colors hover:bg-surface-800"
                >
                  <span className="text-sm text-surface-200">{m.name}</span>
                  <PaymentStatusBadge status={m.paymentStatus} />
                </Link>
              ))}
          </div>
        </Card>
      )}

      {/* Payments table */}
      <Card padding="none">
        <div className="px-6 py-4">
          <CardHeader
            title="Payment History"
            description={`${payments.length} recent payments`}
          />
        </div>

        {payments.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-surface-500">
              No payments recorded yet
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-y border-surface-700 text-left">
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500">
                    Member
                  </th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500">
                    Amount
                  </th>
                  <th className="hidden px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500 sm:table-cell">
                    Period
                  </th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500">
                    Paid
                  </th>
                  <th className="hidden px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500 md:table-cell">
                    Recorded By
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/50">
                {payments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="transition-colors hover:bg-surface-800/80"
                  >
                    <td className="px-6 py-3">
                      <Link
                        href={`/members/${payment.memberId}`}
                        className="text-sm font-medium text-surface-200 hover:text-primary-300"
                      >
                        {payment.memberName}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-sm font-medium text-surface-200">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="hidden px-6 py-3 text-sm text-surface-400 sm:table-cell">
                      {format(new Date(payment.periodStart), "MMM d")} –{" "}
                      {format(new Date(payment.periodEnd), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-3 text-sm text-surface-400">
                      {format(new Date(payment.paidAt), "MMM d, yyyy")}
                    </td>
                    <td className="hidden px-6 py-3 text-sm text-surface-500 md:table-cell">
                      {payment.recordedBy || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Record Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          resetForm();
        }}
        title="Record Payment"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <Select
            label="Member"
            options={[
              { value: "", label: "Select a member..." },
              ...members.map((m) => ({ value: m.id, label: m.name })),
            ]}
            value={selectedMember}
            onChange={(e) => setSelectedMember(e.target.value)}
            error={payErrors.member}
          />

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

          {payErrors.form && (
            <p className="text-sm text-error-500" role="alert">
              {payErrors.form}
            </p>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" variant="primary" loading={loading}>
              Record Payment
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowPaymentModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
