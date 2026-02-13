"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

interface DepartedClientProps {
  userId: string;
  userName: string;
}

export function DepartedClient({
  userId,
  userName,
}: DepartedClientProps): React.ReactElement {
  const { addToast } = useToast();
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  async function handleRequestRejoin(): Promise<void> {
    setRequesting(true);
    try {
      const res = await fetch(`/api/members/${userId}/rejoin-request`, {
        method: "POST",
      });

      if (res.ok) {
        setRequested(true);
        addToast({
          type: "success",
          title: "Rejoin request sent",
          message: "The owner has been notified of your request.",
        });
      } else {
        addToast({ type: "error", title: "Failed to send request" });
      }
    } catch {
      addToast({ type: "error", title: "Network error" });
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        {/* Heart icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-700/20 border border-primary-700/30">
          <svg
            className="h-10 w-10 text-primary-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <h1 className="mb-2 text-2xl font-bold text-surface-100">
          We miss you, {userName}!
        </h1>
        <p className="mb-6 text-surface-400">
          Your account is currently deactivated. Your training history and
          records are safely preserved.
        </p>

        <Card>
          <p className="text-sm text-surface-300 mb-4">
            Ready to get back to training? Send a rejoin request and the gym
            owner will reactivate your account.
          </p>

          {requested ? (
            <div className="rounded-lg bg-success-700/10 border border-success-700/30 px-4 py-3">
              <p className="text-sm text-success-400">
                Your rejoin request has been sent! The owner will review it
                and get back to you.
              </p>
            </div>
          ) : (
            <Button
              variant="primary"
              onClick={handleRequestRejoin}
              loading={requesting}
            >
              Request to Rejoin
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}
