"use client";

import { signOut } from "next-auth/react";

interface LockoutScreenProps {
  memberName: string;
  ownerEmail?: string;
}

export function LockoutScreen({
  memberName,
  ownerEmail,
}: LockoutScreenProps): React.ReactElement {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div role="alert" className="max-w-md text-center">
        {/* Lock icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-error-700/20 border border-error-700/30">
          <svg
            className="h-10 w-10 text-error-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <h1 className="mb-2 text-2xl font-bold text-surface-100">
          Account Locked
        </h1>
        <p className="mb-6 text-surface-400">
          Hi {memberName}, your account has been locked due to an overdue payment.
          Your schedule access and class attendance have been temporarily restricted.
        </p>

        <div className="rounded-lg border border-surface-700 bg-surface-800 p-4 text-left">
          <h3 className="mb-2 text-sm font-semibold text-surface-200">
            To restore your access:
          </h3>
          <ol className="space-y-2 text-sm text-surface-400">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-900/50 text-xs font-bold text-primary-300">
                1
              </span>
              <span>Make your monthly payment to the gym owner in person (cash only)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-900/50 text-xs font-bold text-primary-300">
                2
              </span>
              <span>The owner will record your payment in the system</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-900/50 text-xs font-bold text-primary-300">
                3
              </span>
              <span>Your access will be restored automatically</span>
            </li>
          </ol>
        </div>

        {ownerEmail && (
          <p className="mt-4 text-sm text-surface-500">
            Questions? Contact{" "}
            <a
              href={`mailto:${ownerEmail}`}
              className="text-primary-400 hover:text-primary-300 underline"
            >
              {ownerEmail}
            </a>
          </p>
        )}

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-surface-600 bg-surface-800 px-4 py-2 text-sm font-medium text-surface-300 transition-colors hover:bg-surface-700 hover:text-surface-100"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H3zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"
              clipRule="evenodd"
            />
          </svg>
          Log Out
        </button>
      </div>
    </div>
  );
}

export type { LockoutScreenProps };
