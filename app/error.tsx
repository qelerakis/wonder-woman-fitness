"use client";

import { Button } from "@/components/ui/Button";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({
  error,
  reset,
}: ErrorPageProps): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950 px-4">
      <div className="max-w-md text-center">
        {/* Error icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-error-700/20 border border-error-700/30">
          <svg
            className="h-10 w-10 text-error-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <h1 className="mb-2 text-2xl font-bold text-surface-100">
          Something went wrong
        </h1>
        <p className="mb-6 text-surface-400">
          An unexpected error occurred. Please try again or contact support
          if the problem persists.
        </p>

        {error.digest && (
          <p className="mb-4 text-xs text-surface-600">
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex items-center justify-center gap-3">
          <Button variant="primary" onClick={reset}>
            Try Again
          </Button>
          <Button variant="ghost" onClick={() => (window.location.href = "/")}>
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
}
