"use client";

import Link from "next/link";
import type { PaymentStatus } from "@/lib/constants";
import { GRACE_PERIOD_DAYS } from "@/lib/constants";

interface PaymentBannerProps {
  status: PaymentStatus;
  daysIntoGracePeriod?: number;
}

export function PaymentBanner({
  status,
  daysIntoGracePeriod = 0,
}: PaymentBannerProps): React.ReactElement | null {
  // Only show banner for grace period and locked statuses
  if (status !== "GRACE_PERIOD" && status !== "LOCKED") {
    return null;
  }

  const daysRemaining = Math.max(0, GRACE_PERIOD_DAYS - daysIntoGracePeriod);

  if (status === "GRACE_PERIOD") {
    return (
      <div className="border-b border-warning-700/30 bg-warning-700/10 px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <svg
              className="h-5 w-5 shrink-0 text-warning-500"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm text-warning-500">
              <span className="font-semibold">Payment due.</span>{" "}
              {daysRemaining > 0
                ? `You have ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining before your account is locked.`
                : "Your account will be locked tomorrow. Please make your payment."}
            </p>
          </div>
          <Link
            href="/profile#payment"
            className="shrink-0 rounded-lg bg-warning-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-warning-700 transition-colors"
          >
            Pay Now
          </Link>
        </div>
      </div>
    );
  }

  // LOCKED status
  return (
    <div className="border-b border-error-700/30 bg-error-700/10 px-4 py-3">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <svg
            className="h-5 w-5 shrink-0 text-error-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm text-error-500">
            <span className="font-semibold">Account locked.</span>{" "}
            Your access is restricted until payment is received. Please contact the gym owner.
          </p>
        </div>
      </div>
    </div>
  );
}

export type { PaymentBannerProps };
