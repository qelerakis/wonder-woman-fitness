"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { MAX_DEPART_REASON_LENGTH } from "@/lib/constants";

interface StopTrainingClientProps {
  userId: string;
  userName: string;
}

export function StopTrainingClient({
  userId,
  userName,
}: StopTrainingClientProps): React.ReactElement {
  const router = useRouter();
  const { addToast } = useToast();
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleStopTraining(): Promise<void> {
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "DEPARTED",
          departReason: reason.trim() || undefined,
        }),
      });

      if (res.ok) {
        addToast({ type: "success", title: "Your account has been deactivated" });
        router.push("/member/departed");
      } else {
        addToast({ type: "error", title: "Failed to process request" });
      }
    } catch {
      addToast({ type: "error", title: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-100">
          Stop Training
        </h1>
        <p className="mt-1 text-sm text-surface-400">
          We&apos;re sad to see you go, {userName}
        </p>
      </div>

      <Card>
        <CardHeader
          title="Are you sure?"
          description="This will deactivate your account and remove you from all future sessions."
        />

        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-warning-700/30 bg-warning-700/10 px-4 py-3">
            <h3 className="text-sm font-medium text-warning-500">
              What happens when you leave:
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-warning-400">
              <li>
                &bull; You will be removed from all upcoming class sessions
              </li>
              <li>
                &bull; You will lose access to the schedule and voting
              </li>
              <li>
                &bull; Your payment and attendance history will be preserved
              </li>
              <li>
                &bull; You can request to rejoin at any time
              </li>
            </ul>
          </div>

          <Textarea
            label="Reason for leaving (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Help us improve — why are you leaving?"
            rows={3}
            helpText={`${reason.length}/${MAX_DEPART_REASON_LENGTH} characters`}
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="confirm-depart"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="h-4 w-4 rounded border-surface-600 bg-surface-800 text-primary-500 focus:ring-primary-500"
            />
            <label
              htmlFor="confirm-depart"
              className="text-sm text-surface-300"
            >
              I understand this will deactivate my account
            </label>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="danger"
              onClick={handleStopTraining}
              loading={loading}
              disabled={!confirmed}
            >
              Stop Training
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
