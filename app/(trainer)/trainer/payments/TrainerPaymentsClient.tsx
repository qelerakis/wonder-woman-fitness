"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format, getDaysInMonth } from "date-fns";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { DatePicker } from "@/components/ui/DatePicker";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { Select } from "@/components/ui/Select";
import { PaymentStatusBadge } from "@/components/payment/PaymentStatusBadge";
import { useToast } from "@/components/ui/Toast";
import { PAYMENTS_START_YEAR } from "@/lib/constants";
import type { PaymentStatus } from "@/lib/constants";

interface TrainerPaymentItem {
  id: string;
  amount: number;
  paidAt: string;
  periodStart: string;
  periodEnd: string;
  memberName: string;
  recordedBy: string | null;
}

interface MemberStatus {
  id: string;
  name: string;
  paymentStatus: PaymentStatus;
}

interface TrainerPaymentsSummary {
  thisMonthRevenue: number;
  paidCount: number;
  unpaidCount: number;
  totalMembers: number;
}

interface TrainerPaymentsClientProps {
  payments: TrainerPaymentItem[];
  members: MemberStatus[];
  summary: TrainerPaymentsSummary;
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

export function TrainerPaymentsClient(
  props: TrainerPaymentsClientProps
): React.ReactElement {
  const { payments: initialPayments, members, summary, initialMonth, initialYear } = props;
  const router = useRouter();
  const { addToast } = useToast();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Filter state
  const [filterMonth, setFilterMonth] = useState<number | null>(initialMonth);
  const [filterYear, setFilterYear] = useState<number | null>(initialYear);
  const [searchQuery, setSearchQuery] = useState("");
  const [displayedPayments, setDisplayedPayments] = useState<TrainerPaymentItem[]>(initialPayments);
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
        const json: unknown = await res.json();
        if (typeof json !== "object" || json === null || !("data" in json)) {
          addToast({ type: "error", title: "Unexpected response format" });
          return;
        }
        const data = (json as { data: Array<{
          id: string;
          amount: number | string;
          paidAt: string;
          periodStart: string;
          periodEnd: string;
          user: { id: string; name: string };
          recordedBy: { id: string; name: string } | null;
        }> }).data;
        setDisplayedPayments(data.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          paidAt: p.paidAt,
          periodStart: p.periodStart,
          periodEnd: p.periodEnd,
          memberName: p.user.name,
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
  const [payErrors, setPayErrors] = useState<Record<string, string>>({});

  function resetForm(): void {
    setSelectedMember("");
    setPayAmount("");
    setPayDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setPayPeriodStart(format(new Date(), "yyyy-MM-dd"));
    setPayPeriodEnd("");
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
        }),
      });

      if (res.ok) {
        addToast({ type: "success", title: "Payment recorded" });
        setShowPaymentModal(false);
        resetForm();
        router.refresh();
        fetchPayments(filterMonth, filterYear);
      } else {
        const data = await res.json() as { error: string };
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

      {/* Summary cards — 3 cards, no all-time */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg bg-surface-900/50 px-3 py-2"
                >
                  <span className="text-sm text-surface-200">{m.name}</span>
                  <PaymentStatusBadge status={m.paymentStatus} />
                </div>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/50">
                {visiblePayments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="transition-colors hover:bg-surface-800/80"
                  >
                    <td className="px-6 py-3">
                      <span className="text-sm font-medium text-surface-200">
                        {payment.memberName}
                      </span>
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
