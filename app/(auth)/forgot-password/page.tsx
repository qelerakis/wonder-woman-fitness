"use client";

import Link from "next/link";

export default function ForgotPasswordPage(): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950 px-4">
      <div className="w-full max-w-md rounded-xl border border-surface-800 bg-surface-900 p-8 text-center">
        <h1 className="text-2xl font-bold text-surface-100">
          Reset Password
        </h1>
        <p className="mt-4 text-surface-400">
          To reset your password, please contact the gym owner directly.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-lg bg-primary-600 px-6 py-2 text-sm font-medium text-white hover:bg-primary-500 transition-colors"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}
