"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";

interface PrivateSessionItem {
  id: string;
  clientName: string;
  scheduledAt: string;
  paid: boolean;
  amount: number;
  exerciseDetails: string | null;
  notes: string | null;
  createdBy: string;
}

interface PrivateSessionsSummary {
  totalRevenue: number;
  thisMonthRevenue: number;
  unpaidCount: number;
  totalSessions: number;
}

interface PrivateSessionsClientProps {
  sessions: PrivateSessionItem[];
  summary: PrivateSessionsSummary;
}

export function PrivateSessionsClient({
  sessions,
  summary,
}: PrivateSessionsClientProps): React.ReactElement {
  const router = useRouter();
  const { addToast } = useToast();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Create form state
  const [clientName, setClientName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState(false);
  const [exerciseDetails, setExerciseDetails] = useState("");
  const [notes, setNotes] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  function resetForm(): void {
    setClientName("");
    setScheduledAt("");
    setAmount("");
    setPaid(false);
    setExerciseDetails("");
    setNotes("");
    setFormErrors({});
  }

  async function handleCreate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!clientName.trim()) errors.clientName = "Client name is required";
    if (!scheduledAt) errors.scheduledAt = "Date/time is required";
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      errors.amount = "Amount must be a positive number";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/private-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: clientName.trim(),
          scheduledAt: new Date(scheduledAt).toISOString(),
          amount: parsedAmount,
          paid,
          exerciseDetails: exerciseDetails.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      if (res.ok) {
        addToast({ type: "success", title: "Private session created" });
        setShowCreateModal(false);
        resetForm();
        router.refresh();
      } else {
        const data: { error: string } = await res.json();
        addToast({
          type: "error",
          title: "Failed to create session",
          message: data.error,
        });
      }
    } catch {
      addToast({ type: "error", title: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleTogglePaid(sessionId: string, currentPaid: boolean): Promise<void> {
    try {
      const res = await fetch(`/api/private-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: !currentPaid }),
      });

      if (res.ok) {
        addToast({
          type: "success",
          title: currentPaid ? "Marked as unpaid" : "Marked as paid",
        });
        router.refresh();
      } else {
        addToast({ type: "error", title: "Failed to update" });
      }
    } catch {
      addToast({ type: "error", title: "Network error" });
    }
  }

  function formatCurrency(val: number): string {
    return `${val.toLocaleString()} MKD`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">
            Private Sessions
          </h1>
          <p className="mt-1 text-sm text-surface-400">
            Track 1-on-1 sessions and revenue
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowCreateModal(true)}
        >
          New Session
        </Button>
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
            Total Sessions
          </p>
          <p className="mt-1 text-xl font-bold text-surface-100">
            {summary.totalSessions}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">
            Unpaid
          </p>
          <p
            className={`mt-1 text-xl font-bold ${
              summary.unpaidCount > 0 ? "text-warning-400" : "text-surface-100"
            }`}
          >
            {summary.unpaidCount}
          </p>
        </Card>
      </div>

      {/* Sessions table */}
      <Card padding="none">
        <div className="px-6 py-4">
          <CardHeader
            title="Sessions"
            description={`${sessions.length} sessions`}
          />
        </div>

        {sessions.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-surface-500">
              No private sessions recorded yet
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-y border-surface-700 text-left">
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500">
                    Client
                  </th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500">
                    Date
                  </th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500">
                    Amount
                  </th>
                  <th className="hidden px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500 md:table-cell">
                    Details
                  </th>
                  <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-surface-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700/50">
                {sessions.map((ps) => (
                  <tr
                    key={ps.id}
                    className="transition-colors hover:bg-surface-800/80"
                  >
                    <td className="px-6 py-3">
                      <p className="text-sm font-medium text-surface-200">
                        {ps.clientName}
                      </p>
                    </td>
                    <td className="px-6 py-3 text-sm text-surface-400">
                      {format(new Date(ps.scheduledAt), "MMM d, yyyy h:mm a")}
                    </td>
                    <td className="px-6 py-3 text-sm font-medium text-surface-200">
                      {formatCurrency(ps.amount)}
                    </td>
                    <td className="hidden px-6 py-3 text-sm text-surface-400 md:table-cell">
                      <p className="max-w-xs truncate">
                        {ps.exerciseDetails || "—"}
                      </p>
                    </td>
                    <td className="px-6 py-3">
                      <button
                        onClick={() => handleTogglePaid(ps.id, ps.paid)}
                        className="cursor-pointer"
                      >
                        <Badge
                          variant={ps.paid ? "success" : "warning"}
                          size="sm"
                        >
                          {ps.paid ? "Paid" : "Unpaid"}
                        </Badge>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        title="New Private Session"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Client Name"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Client's full name"
            error={formErrors.clientName}
          />

          <Input
            label="Scheduled At"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            error={formErrors.scheduledAt}
          />

          <Input
            label="Amount (MKD)"
            type="number"
            step="1"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g., 500"
            error={formErrors.amount}
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="paid-checkbox"
              checked={paid}
              onChange={(e) => setPaid(e.target.checked)}
              className="h-4 w-4 rounded border-surface-600 bg-surface-800 text-primary-500 focus:ring-primary-500"
            />
            <label
              htmlFor="paid-checkbox"
              className="text-sm text-surface-300"
            >
              Already paid
            </label>
          </div>

          <Textarea
            label="Exercise Details (optional)"
            value={exerciseDetails}
            onChange={(e) => setExerciseDetails(e.target.value)}
            placeholder="Describe the exercises planned..."
            rows={3}
          />

          <Textarea
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes..."
            rows={2}
          />

          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" variant="primary" loading={loading}>
              Create Session
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowCreateModal(false);
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
