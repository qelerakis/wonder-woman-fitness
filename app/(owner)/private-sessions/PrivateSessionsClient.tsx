"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
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

interface TrainerOption {
  id: string;
  name: string;
}

interface PrivateSessionsClientProps {
  sessions: PrivateSessionItem[];
  summary: PrivateSessionsSummary;
  trainers?: TrainerOption[];
  currentUserId?: string;
}

export function PrivateSessionsClient({
  sessions,
  summary,
  trainers,
  currentUserId,
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
  const [trainerId, setTrainerId] = useState(currentUserId ?? "");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Month filter state
  const [viewMode, setViewMode] = useState<"all" | "month">("all");
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [filteredSessions, setFilteredSessions] = useState<PrivateSessionItem[]>(sessions);
  const [filteredSummary, setFilteredSummary] = useState<PrivateSessionsSummary>(summary);
  const [filterLoading, setFilterLoading] = useState(false);

  // Sync filtered state with props when they change (e.g. after router.refresh())
  useEffect(() => {
    if (viewMode === "all") {
      setFilteredSessions(sessions);
      setFilteredSummary(summary);
    }
  }, [sessions, summary, viewMode]);

  function resetForm(): void {
    setClientName("");
    setScheduledAt("");
    setAmount("");
    setPaid(false);
    setExerciseDetails("");
    setNotes("");
    setTrainerId(currentUserId ?? "");
    setFormErrors({});
  }

  function computeSummary(data: PrivateSessionItem[]): PrivateSessionsSummary {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const totalRevenue = data
      .filter((ps) => ps.paid && ps.amount != null)
      .reduce((sum, ps) => sum + ps.amount, 0);
    const thisMonthRevenue = data
      .filter(
        (ps) => ps.paid && ps.amount != null && new Date(ps.scheduledAt) >= thisMonthStart
      )
      .reduce((sum, ps) => sum + ps.amount, 0);
    const unpaidCount = data.filter((ps) => !ps.paid).length;
    return { totalRevenue, thisMonthRevenue, unpaidCount, totalSessions: data.length };
  }

  async function fetchByMonth(month: number, year: number): Promise<void> {
    setFilterLoading(true);
    try {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00.000Z`;
      const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}T23:59:59.999Z`;
      const res = await fetch(`/api/private-sessions?startDate=${startDate}&endDate=${endDate}`);
      if (res.ok) {
        const json: { data: Array<Record<string, unknown>> } = await res.json();
        const data: PrivateSessionItem[] = json.data.map((ps) => ({
          id: ps.id as string,
          clientName: ps.clientName as string,
          scheduledAt: ps.scheduledAt as string,
          paid: ps.paid as boolean,
          amount: Number(ps.amount ?? 0),
          exerciseDetails: (ps.exerciseDetails as string | null) ?? null,
          notes: (ps.notes as string | null) ?? null,
          createdBy: ((ps.createdBy as { name: string }) ?? { name: "" }).name,
        }));
        setFilteredSessions(data);
        setFilteredSummary(computeSummary(data));
      } else {
        addToast({ type: "error", title: "Failed to load sessions" });
      }
    } catch {
      addToast({ type: "error", title: "Network error" });
    } finally {
      setFilterLoading(false);
    }
  }

  function handleShowAll(): void {
    setViewMode("all");
    setFilteredSessions(sessions);
    setFilteredSummary(summary);
  }

  function handleShowMonth(): void {
    const month = new Date().getMonth();
    const year = new Date().getFullYear();
    setViewMode("month");
    setViewMonth(month);
    setViewYear(year);
    fetchByMonth(month, year);
  }

  function handlePrevMonth(): void {
    let newMonth = viewMonth - 1;
    let newYear = viewYear;
    if (newMonth < 0) { newMonth = 11; newYear -= 1; }
    setViewMonth(newMonth);
    setViewYear(newYear);
    fetchByMonth(newMonth, newYear);
  }

  function handleNextMonth(): void {
    const now = new Date();
    if (viewMonth === now.getMonth() && viewYear === now.getFullYear()) return;
    let newMonth = viewMonth + 1;
    let newYear = viewYear;
    if (newMonth > 11) { newMonth = 0; newYear += 1; }
    setViewMonth(newMonth);
    setViewYear(newYear);
    fetchByMonth(newMonth, newYear);
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
          ...(trainerId ? { trainerId } : {}),
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
          <div className="mt-1 flex items-center gap-2">
            {viewMode === "month" ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevMonth}
                  disabled={filterLoading}
                  className="rounded p-0.5 text-surface-400 transition-colors hover:text-surface-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Previous month"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                <span className="text-sm text-surface-400">
                  {format(new Date(viewYear, viewMonth, 1), "MMMM yyyy")}
                </span>
                <button
                  onClick={handleNextMonth}
                  disabled={filterLoading || (viewMonth === new Date().getMonth() && viewYear === new Date().getFullYear())}
                  className="rounded p-0.5 text-surface-400 transition-colors hover:text-surface-100 disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Next month"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ) : (
              <p className="text-sm text-surface-400">All sessions</p>
            )}
            <div className="flex gap-1">
              <button
                onClick={handleShowAll}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  viewMode === "all"
                    ? "bg-primary-900/50 text-primary-300"
                    : "text-surface-500 hover:text-surface-300"
                }`}
              >
                All
              </button>
              <button
                onClick={handleShowMonth}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  viewMode === "month"
                    ? "bg-primary-900/50 text-primary-300"
                    : "text-surface-500 hover:text-surface-300"
                }`}
              >
                Monthly
              </button>
            </div>
          </div>
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
      <div className={`grid grid-cols-2 gap-4 lg:grid-cols-4 transition-opacity ${filterLoading ? "opacity-50" : ""}`}>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">
            This Month
          </p>
          <p className="mt-1 text-xl font-bold text-surface-100">
            {formatCurrency(filteredSummary.thisMonthRevenue)}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">
            All Time
          </p>
          <p className="mt-1 text-xl font-bold text-surface-100">
            {formatCurrency(filteredSummary.totalRevenue)}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">
            Total Sessions
          </p>
          <p className="mt-1 text-xl font-bold text-surface-100">
            {filteredSummary.totalSessions}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">
            Unpaid
          </p>
          <p
            className={`mt-1 text-xl font-bold ${
              filteredSummary.unpaidCount > 0 ? "text-warning-400" : "text-surface-100"
            }`}
          >
            {filteredSummary.unpaidCount}
          </p>
        </Card>
      </div>

      {/* Sessions table */}
      <Card padding="none">
        <div className="px-6 py-4">
          <CardHeader
            title="Sessions"
            description={`${filteredSessions.length} sessions`}
          />
        </div>

        {filteredSessions.length === 0 ? (
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
                    Trainer
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
                {filteredSessions.map((ps) => (
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
                      {ps.createdBy}
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
                      {!ps.paid && ps.amount === 0 ? (
                        <Badge variant="warning" size="sm">
                          Unpaid
                        </Badge>
                      ) : (
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
                      )}
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

          <DateTimePicker
            label="Scheduled At"
            value={scheduledAt}
            onChange={(v) => setScheduledAt(v)}
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

          {trainers && trainers.length > 0 && (
            <Select
              label="Trainer"
              value={trainerId}
              onChange={(e) => setTrainerId(e.target.value)}
              options={trainers.map((t) => ({ value: t.id, label: t.name }))}
            />
          )}

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
