"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format, getDaysInMonth } from "date-fns";
import { useTranslations } from "next-intl";
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

const MONTH_KEYS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
] as const;

export function PaymentsClient(
  props: PaymentsClientProps
): React.ReactElement {
  const { payments: initialPayments, members, summary, initialMonth, initialYear } = props;
  const router = useRouter();
  const { addToast } = useToast();
  const t = useTranslations("payments");
  const tCommon = useTranslations("common");
  const tVal = useTranslations("validation");
  const tMonths = useTranslations("months");

  const MONTH_OPTIONS = useMemo(() =>
    MONTH_KEYS.map((key, index) => ({ value: String(index), label: tMonths(key) })),
    [tMonths]
  );
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
          addToast({ type: "error", title: t("unexpectedResponseFormat") });
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
        addToast({ type: "error", title: t("failedToLoadPayments") });
      }
    } catch {
      addToast({ type: "error", title: t("failedToLoadPayments") });
    } finally {
      setLoadingPayments(false);
    }
  }, [addToast, t]);

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

    if (!selectedMember) errors.member = tVal("selectMember");
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
        addToast({ type: "success", title: isEditing ? t("paymentUpdated") : t("paymentRecorded") });
        setShowPaymentModal(false);
        setEditingPayment(null);
        resetForm();
        router.refresh();
        fetchPayments(filterMonth, filterYear);
      } else {
        const data: { error: string } = await res.json();
        addToast({
          type: "error",
          title: isEditing ? t("failedToUpdate") : t("failedToRecordPayment"),
          message: data.error,
        });
      }
    } catch {
      addToast({ type: "error", title: tCommon("networkError") });
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
        addToast({ type: "success", title: t("paymentDeleted") });
        setDeletingPayment(null);
        router.refresh();
        fetchPayments(filterMonth, filterYear);
      } else {
        const data: { error: string } = await res.json();
        addToast({
          type: "error",
          title: t("failedToDelete"),
          message: data.error,
        });
      }
    } catch {
      addToast({ type: "error", title: tCommon("networkError") });
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">{t("title")}</h1>
          <p className="mt-1 text-sm text-surface-400">
            {t("subtitle")}
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowPaymentModal(true)}
        >
          {t("recordPayment")}
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
            aria-label={t("filterByMonth")}
          />
          <Select
            options={yearOptions}
            value={filterYear !== null ? String(filterYear) : ""}
            onChange={(e) => handleYearChange(e.target.value)}
            className="w-[90px] !py-1.5 text-sm"
            aria-label={t("filterByYear")}
          />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <input
            type="text"
            placeholder={t("searchByName")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[180px] rounded-lg border border-surface-600 bg-surface-800 px-3 py-1.5 text-sm text-surface-100 placeholder:text-surface-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1 focus:ring-offset-surface-900 hover:border-surface-500"
            aria-label={t("searchAriaLabel")}
          />
          {hasActiveFilter && (
            <button
              onClick={handleClearFilters}
              className="text-sm text-surface-500 transition-colors hover:text-primary-300"
            >
              {tCommon("clear")}
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">
            {t("thisMonth")}
          </p>
          <p className="mt-1 text-xl font-bold text-surface-100">
            {formatCurrency(summary.thisMonthRevenue)}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">
            {t("allTime")}
          </p>
          <p className="mt-1 text-xl font-bold text-surface-100">
            {formatCurrency(summary.totalRevenue)}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">
            {t("paidMembers")}
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
            {t("unpaid")}
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
            title={t("unpaidMembers")}
            description={t("unpaidMembersSubtitle")}
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
            title={t("paymentHistory")}
            description={`${t("paymentsCount", { count: visiblePayments.length })}${filterMonth !== null ? ` ${t("paymentsInPeriod", { filterLabel })}` : ""}`}
          />
        </div>

        {visiblePayments.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-surface-500">
              {t("noPayments")}
            </p>
          </div>
        ) : (
          <div className={`overflow-x-auto transition-opacity ${loadingPayments ? "opacity-50" : ""}`}>
            <table className="w-full">
              <thead>
                <tr className="border-y border-surface-700 text-left">
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500">
                    {t("member")}
                  </th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500">
                    {t("amount")}
                  </th>
                  <th className="hidden px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500 sm:table-cell">
                    {t("period")}
                  </th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500">
                    {t("paid")}
                  </th>
                  <th className="hidden px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500 md:table-cell">
                    {t("recordedBy")}
                  </th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500">
                    <span className="sr-only">{tCommon("actions")}</span>
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
                          aria-label={t("editPaymentFor", { memberName: payment.memberName })}
                          onClick={() => handleEditPayment(payment)}
                          className="rounded p-1 text-surface-500 transition-colors hover:bg-surface-700 hover:text-surface-200"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          aria-label={t("deletePaymentFor", { memberName: payment.memberName })}
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
        title={editingPayment ? t("editPayment") : t("recordPayment")}
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <Select
            label={t("member")}
            options={[
              { value: "", label: t("selectMember") },
              ...members.map((m) => ({ value: m.id, label: m.name })),
            ]}
            value={selectedMember}
            onChange={(e) => setSelectedMember(e.target.value)}
            error={payErrors.member}
            disabled={!!editingPayment}
          />

          <Input
            label={t("amountMKD")}
            type="number"
            step="1"
            min="1"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            placeholder={t("amountPlaceholder")}
            error={payErrors.amount}
          />

          <DateTimePicker
            label={t("paidAt")}
            value={payDate}
            onChange={(v) => setPayDate(v)}
            error={payErrors.paidAt}
          />

          <div className="grid grid-cols-2 gap-3">
            <DatePicker
              label={t("periodStart")}
              value={payPeriodStart}
              onChange={(v) => setPayPeriodStart(v)}
              error={payErrors.periodStart}
            />
            <DatePicker
              label={t("periodEnd")}
              value={payPeriodEnd}
              onChange={(v) => setPayPeriodEnd(v)}
              error={payErrors.periodEnd}
            />
          </div>

          <Textarea
            label={t("notes")}
            value={payNotes}
            onChange={(e) => setPayNotes(e.target.value)}
            placeholder={t("notesPlaceholder")}
            rows={2}
          />

          {payErrors.form && (
            <p className="text-sm text-error-500" role="alert">
              {payErrors.form}
            </p>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" variant="primary" loading={loading}>
              {editingPayment ? t("updatePayment") : t("recordPayment")}
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
              {tCommon("cancel")}
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
              memberName: deletingPayment?.memberName ?? "",
            })}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="danger" onClick={handleDeletePayment} loading={deleteLoading}>
              {tCommon("delete")}
            </Button>
            <Button variant="ghost" onClick={() => setDeletingPayment(null)}>
              {tCommon("cancel")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
