"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Card, CardHeader } from "@/components/ui/Card";
import { PaymentStatusBadge } from "@/components/payment/PaymentStatusBadge";
import { useToast } from "@/components/ui/Toast";
import type { PaymentStatus } from "@/lib/constants";

interface PaymentRecord {
  id: string;
  amount: number;
  paidAt: string;
  periodStart: string;
  periodEnd: string;
}

export type MemberStatus = "TRIAL" | "ACTIVE" | "DEPARTED";

interface PaymentInfoSectionProps {
  status: PaymentStatus;
  daysRemaining: number | null;
  lastPaymentDate: string | null;
  paidThroughDate: string | null;
  nextPaymentDue: string | null;
  recentPayments: PaymentRecord[];
  totalPaymentCount: number;
  userStatus: MemberStatus;
  trialEndsAt: string | null;
}

function formatDate(iso: string): string {
  return format(new Date(iso), "MMM d, yyyy");
}

function formatCurrency(amount: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)} MKD`;
}

export function PaymentInfoSection({
  status,
  daysRemaining,
  lastPaymentDate,
  paidThroughDate,
  nextPaymentDue,
  recentPayments,
  totalPaymentCount,
  userStatus,
  trialEndsAt,
}: PaymentInfoSectionProps): React.ReactElement {
  const t = useTranslations("profile");
  const { addToast } = useToast();

  const [showAll, setShowAll] = useState(false);
  const [allPayments, setAllPayments] = useState<PaymentRecord[] | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);

  const hasAnyDate = lastPaymentDate || paidThroughDate || nextPaymentDue;
  const hasPayments = recentPayments.length > 0;
  const canShowAll = totalPaymentCount > recentPayments.length;

  const displayedPayments = showAll && allPayments ? allPayments : recentPayments;

  async function handleShowAll(): Promise<void> {
    if (showAll) {
      setShowAll(false);
      return;
    }

    if (allPayments) {
      setShowAll(true);
      return;
    }

    setLoadingAll(true);
    try {
      const res = await fetch("/api/payments/my");
      if (res.ok) {
        const data: { data: PaymentRecord[] } = await res.json();
        setAllPayments(data.data);
        setShowAll(true);
      } else {
        addToast({ type: "error", title: t("failedToLoadPayments") });
      }
    } catch {
      addToast({ type: "error", title: t("failedToLoadPayments") });
    } finally {
      setLoadingAll(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Payment Status Card */}
      <Card>
        <CardHeader
          title={t("paymentInformation")}
          action={<PaymentStatusBadge status={status} />}
        />

        {/* Status-specific alert bar */}
        {status === "GRACE_PERIOD" && daysRemaining !== null && (
          <div role="alert" className="mt-4 rounded-lg border border-warning-700/50 bg-warning-900/30 px-4 py-3">
            <p className="text-sm text-warning-300">
              {userStatus === "TRIAL"
                ? t("daysRemainingInTrial", { count: daysRemaining })
                : t("daysRemainingToPay", { count: daysRemaining })}
            </p>
          </div>
        )}

        {status === "LOCKED" && (
          <div role="alert" className="mt-4 rounded-lg border border-error-700/50 bg-error-900/30 px-4 py-3">
            <p className="text-sm font-medium text-error-300">
              {t("paymentOverdue")}
            </p>
          </div>
        )}

        {status === "OVERRIDE" && (
          <div role="alert" className="mt-4 rounded-lg border border-primary-700/50 bg-primary-900/30 px-4 py-3">
            <p className="text-sm text-primary-300">
              {t("overrideActive")}
            </p>
          </div>
        )}

        {/* Date info grid */}
        {hasAnyDate && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {lastPaymentDate && (
              <div>
                <p className="text-xs text-surface-500">{t("lastPayment")}</p>
                <p className="text-sm font-medium text-surface-200">
                  {formatDate(lastPaymentDate)}
                </p>
              </div>
            )}
            {paidThroughDate && (
              <div>
                <p className="text-xs text-surface-500">{t("paidThrough")}</p>
                <p className="text-sm font-medium text-surface-200">
                  {formatDate(paidThroughDate)}
                </p>
              </div>
            )}
            {nextPaymentDue && (
              <div>
                <p className="text-xs text-surface-500">{t("nextPaymentDue")}</p>
                <p className="text-sm font-medium text-surface-200">
                  {formatDate(nextPaymentDue)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!hasPayments && !hasAnyDate && (
          <div className="mt-4 py-4 text-center">
            <p className="text-sm text-surface-500">{t("noPaymentsYet")}</p>
            {userStatus === "TRIAL" && trialEndsAt && (
              <p className="mt-1 text-sm text-surface-400">
                {t("trialEndsOn", { date: formatDate(trialEndsAt) })}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Payment History */}
      {hasPayments && (
        <Card padding="none">
          <div className="px-6 py-4">
            <CardHeader
              title={t("recentPayments")}
              action={
                canShowAll ? (
                  <button
                    onClick={handleShowAll}
                    disabled={loadingAll}
                    className="text-sm text-primary-400 transition-colors hover:text-primary-300 disabled:opacity-50"
                  >
                    {showAll ? t("showRecent") : t("showAllPayments")}
                  </button>
                ) : undefined
              }
            />
          </div>
          <div className="divide-y divide-surface-700">
            {displayedPayments.map((payment) => (
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
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-surface-400">
                    {formatDate(payment.paidAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export type { PaymentInfoSectionProps, PaymentRecord as PaymentInfoRecord };
