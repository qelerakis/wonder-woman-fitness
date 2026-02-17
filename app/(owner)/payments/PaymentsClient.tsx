"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format, getDaysInMonth } from "date-fns";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { DatePicker } from "@/components/ui/DatePicker";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { PaymentStatusBadge } from "@/components/payment/PaymentStatusBadge";
import { useToast } from "@/components/ui/Toast";
import { PAYMENTS_START_YEAR } from "@/lib/constants";
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
  initialMonth: number;
  initialYear: number;
}

const MONTH_OPTIONS = [
  { value: "0", label: "January" },
  { value: "1", label: "February" },
  { value: "2", label: "March" },
  { value: "3", label: "April" },
  { value: "4", label: "May" },
  { value: "5", label: "June" },
  { value: "6", label: "July" },
  { value: "7", label: "August" },
  { value: "8", label: "September" },
  { value: "9", label: "October" },
  { value: "10", label: "November" },
  { value: "11", label: "December" },
];

export function PaymentsClient(
  props: PaymentsClientProps
): React.ReactElement {
  const { payments: initialPayments, members, summary, initialMonth, initialYear } = props;
  const router = useRouter();
  const { addToast } = useToast();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentItem | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<PaymentItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Filter state
  const [filterMonth, setFilterMonth] = useState<number | null>(initialMonth);
  const [filterYear, setFilterYear] = useState<number | null>(initialYear);
  const [searchQuery, setSearchQuery] = useState("");
  const [displayedPayments, setDisplayedPayments] = useState<PaymentItem[]>(initialPayments);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const [currentMonth] = useState(() => new Date().getMonth());
  const [currentYear] = useState(() => new Date().getFullYear());

  const yearOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    for (let y = PAYMENTS_START_YEAR; y <= currentYear; y++) {
      options.push({ value: String(y), label: String(y) });
    }
    return options;
  }, [currentYear]);

  const monthOptions = MONTH_OPTIONS;

  const fetchPayments = useCallback(async (month: number | null, year: number | null): Promise<void> => {
    if (month === null || year === null) return;
    setLoadingPayments(true);
    try {
      const daysInMonth = getDaysInMonth(new Date(year, month));
      const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
      const res = await fetch(`/api/payments?startDate=${startDate}&endDate=${endDate}`);
      if (res.ok) {
        const json = await res.json();
        if (!json.data) {
          addToast({ type: "error", title: "Unexpected response format" });
          return;
        }
        const data = json.data as Array<{
          id: string;
          amount: number | string;
          paidAt: string;
          periodStart: string;
          periodEnd: string;
          notes: string | null;
          user: { id: string; name: string };
          recordedBy: { id: string; name: string } | null;
        }>;
        setDisplayedPayments(data.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          paidAt: p.paidAt,
          periodStart: p.periodStart,
          periodEnd: p.periodEnd,
          notes: p.notes,
          memberName: p.user.name,
          memberId: p.user.id,
          recordedBy: p.recordedBy?.name || null,
        })));
      } else {
        addToast({ type: "error", title: "Failed to load payments" });
      }
    } catch {
      addToast({ type: "error", title: "Failed to load payments" });
    } finally {
      setLoadingPayments(false);
    }
  }, [addToast]);

  function handleMonthChange(value: string): void {
    const month = value === "" ? null : Number(value);
    setFilterMonth(month);
    fetchPayments(month, filterYear);
  }

  function handleYearChange(value: string): void {
    const year = value === "" ? null : Number(value);
    setFilterYear(year);
    fetchPayments(filterMonth, year);
  }

  function handleClearFilters(): void {
    setFilterMonth(currentMonth);
    setFilterYear(currentYear);
    setSearchQuery("");
    fetchPayments(currentMonth, currentYear);
  }

  const visiblePayments = useMemo(() => {
    if (!searchQuery.trim()) return displayedPayments;
    const q = searchQuery.toLowerCase();
    return displayedPayments.filter((p) => p.memberName.toLowerCase().includes(q));
  }, [displayedPayments, searchQuery]);

  const hasActiveFilter = filterMonth !== currentMonth || filterYear !== currentYear || searchQuery.trim() !== "";

  const filterLabel = filterMonth !== null && filterYear !== null
    ? `${MONTH_OPTIONS[filterMonth].label} ${filterYear}`
    : "";

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

  function handleEditPayment(payment: PaymentItem): void {
    setEditingPayment(payment);
    setSelectedMember(payment.memberId);
    setPayAmount(String(payment.amount));
    setPayDate(format(new Date(payment.paidAt), "yyyy-MM-dd'T'HH:mm"));
    setPayPeriodStart(format(new Date(payment.periodStart), "yyyy-MM-dd"));
    setPayPeriodEnd(format(new Date(payment.periodEnd), "yyyy-MM-dd"));
    setPayNotes(payment.notes || "");
    setPayErrors({});
    setShowPaymentModal(true);
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
      const isEditing = !!editingPayment;
      const url = isEditing
        ? `/api/payments/${editingPayment.id}`
        : "/api/payments";
      const method = isEditing ? "PATCH" : "POST";
      const body = isEditing
        ? {
            amount: parsedAmount,
            paidAt: new Date(payDate).toISOString(),
            periodStart: payPeriodStart,
            periodEnd: payPeriodEnd,
            notes: payNotes.trim() || undefined,
          }
        : {
            userId: selectedMember,
            amount: parsedAmount,
            paidAt: new Date(payDate).toISOString(),
            periodStart: payPeriodStart,
            periodEnd: payPeriodEnd,
            notes: payNotes.trim() || undefined,
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        addToast({ type: "success", title: isEditing ? "Payment updated" : "Payment recorded" });
        setShowPaymentModal(false);
        setEditingPayment(null);
        resetForm();
        router.refresh();
        fetchPayments(filterMonth, filterYear);
      } else {
        const data: { error: string } = await res.json();
        addToast({
          type: "error",
          title: isEditing ? "Failed to update payment" : "Failed to record payment",
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

  async function handleDeletePayment(): Promise<void> {
    if (!deletingPayment) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/payments/${deletingPayment.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        addToast({ type: "success", title: "Payment deleted" });
        setDeletingPayment(null);
        router.refresh();
        fetchPayments(filterMonth, filterYear);
      } else {
        const data: { error: string } = await res.json();
        addToast({
          type: "error",
          title: "Failed to delete payment",
          message: data.error,
        });
      }
    } catch {
      addToast({ type: "error", title: "Network error" });
    } finally {
      setDeleteLoading(false);
    }
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

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-surface-700 bg-surface-800/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Select
            options={monthOptions}
            value={filterMonth !== null ? String(filterMonth) : ""}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="w-[130px] !py-1.5 text-sm"
            aria-label="Filter by month"
          />
          <Select
            options={yearOptions}
            value={filterYear !== null ? String(filterYear) : ""}
            onChange={(e) => handleYearChange(e.target.value)}
            className="w-[90px] !py-1.5 text-sm"
            aria-label="Filter by year"
          />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[180px] rounded-lg border border-surface-600 bg-surface-800 px-3 py-1.5 text-sm text-surface-100 placeholder:text-surface-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 focus:ring-offset-surface-900 hover:border-surface-500"
            aria-label="Search payments by member name"
          />
          {hasActiveFilter && (
            <button
              onClick={handleClearFilters}
              className="text-sm text-surface-500 transition-colors hover:text-primary-300"
            >
              Clear
            </button>
          )}
        </div>
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
            description={`${visiblePayments.length} payments${filterMonth !== null ? ` in ${filterLabel}` : ""}`}
          />
        </div>

        {visiblePayments.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-surface-500">
              No payments recorded yet
            </p>
          </div>
        ) : (
          <div className={`overflow-x-auto transition-opacity ${loadingPayments ? "opacity-50" : ""}`}>
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
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/50">
                {visiblePayments.map((payment) => (
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
                      {payment.recordedBy || "\u2014"}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          aria-label={`Edit payment for ${payment.memberName}`}
                          onClick={() => handleEditPayment(payment)}
                          className="rounded p-1 text-surface-500 transition-colors hover:bg-surface-700 hover:text-surface-200"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete payment for ${payment.memberName}`}
                          onClick={() => setDeletingPayment(payment)}
                          className="rounded p-1 text-surface-500 transition-colors hover:bg-error-900/50 hover:text-error-400"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
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
          setEditingPayment(null);
          resetForm();
        }}
        title={editingPayment ? "Edit Payment" : "Record Payment"}
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
            disabled={!!editingPayment}
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

          <DateTimePicker
            label="Paid At"
            value={payDate}
            onChange={(v) => setPayDate(v)}
            error={payErrors.paidAt}
          />

          <div className="grid grid-cols-2 gap-3">
            <DatePicker
              label="Period Start"
              value={payPeriodStart}
              onChange={(v) => setPayPeriodStart(v)}
              error={payErrors.periodStart}
            />
            <DatePicker
              label="Period End"
              value={payPeriodEnd}
              onChange={(v) => setPayPeriodEnd(v)}
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
              {editingPayment ? "Update Payment" : "Record Payment"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowPaymentModal(false);
                setEditingPayment(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingPayment}
        onClose={() => setDeletingPayment(null)}
        title="Delete Payment"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-300">
            Are you sure you want to delete this payment of{" "}
            <span className="font-medium text-surface-100">
              {deletingPayment ? formatCurrency(deletingPayment.amount) : ""}
            </span>{" "}
            for{" "}
            <span className="font-medium text-surface-100">
              {deletingPayment?.memberName}
            </span>
            ? This action cannot be undone.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="danger" onClick={handleDeletePayment} loading={deleteLoading}>
              Delete
            </Button>
            <Button variant="ghost" onClick={() => setDeletingPayment(null)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
