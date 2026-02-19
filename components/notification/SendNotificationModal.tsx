"use client";

import { useState, useEffect, useCallback } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";
import { MAX_BROADCAST_TITLE_LENGTH, MAX_BROADCAST_BODY_LENGTH, DAY_NAMES } from "@/lib/constants";

type AudienceType = "ALL" | "TRIAL" | "SESSION_SLOT" | "PAYMENT_STATUS" | "INDIVIDUAL";

interface RecurringSlotOption {
  id: string;
  dayOfWeek: number;
  startHour: number;
}

interface MemberOption {
  id: string;
  name: string;
}

interface SendNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  recurringSlots: RecurringSlotOption[];
}

export function SendNotificationModal({
  isOpen,
  onClose,
  recurringSlots,
}: SendNotificationModalProps): React.ReactElement | null {
  const router = useRouter();
  const { addToast } = useToast();

  const [audience, setAudience] = useState<AudienceType>("ALL");
  const [slotId, setSlotId] = useState<string>("");
  const [paymentStatus, setPaymentStatus] = useState<"GRACE_PERIOD" | "LOCKED">("GRACE_PERIOD");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

  const [recipientCount, setRecipientCount] = useState<number>(0);
  const [allMembers, setAllMembers] = useState<MemberOption[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchRecipients = useCallback(async (): Promise<void> => {
    if (audience === "SESSION_SLOT" && !slotId) {
      setRecipientCount(0);
      return;
    }
    setLoadingRecipients(true);
    try {
      const params = new URLSearchParams({ audience });
      if (audience === "SESSION_SLOT" && slotId) {
        params.set("slotId", slotId);
      }
      if (audience === "PAYMENT_STATUS") {
        params.set("paymentStatus", paymentStatus);
      }

      const res = await fetch(`/api/notifications/broadcast/recipients?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRecipientCount(data.data.count);
        if (audience === "INDIVIDUAL") {
          setAllMembers(data.data.members);
        }
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingRecipients(false);
    }
  }, [audience, slotId, paymentStatus]);

  useEffect(() => {
    if (isOpen) {
      fetchRecipients();
    }
  }, [isOpen, fetchRecipients]);

  useEffect(() => {
    if (!isOpen) {
      setAudience("ALL");
      setSlotId("");
      setPaymentStatus("GRACE_PERIOD");
      setSelectedMemberIds([]);
      setTitle("");
      setBody("");
      setMemberSearch("");
      setRecipientCount(0);
      setAllMembers([]);
    }
  }, [isOpen]);

  function toggleMember(memberId: string): void {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  }

  const effectiveCount = audience === "INDIVIDUAL" ? selectedMemberIds.length : recipientCount;
  const canSend = title.trim().length > 0 && body.trim().length > 0 && effectiveCount > 0;

  async function handleSend(): Promise<void> {
    setSending(true);
    try {
      const payload: Record<string, unknown> = {
        audience,
        title: title.trim(),
        body: body.trim(),
      };
      if (audience === "SESSION_SLOT") payload.slotId = slotId;
      if (audience === "PAYMENT_STATUS") payload.paymentStatus = paymentStatus;
      if (audience === "INDIVIDUAL") payload.memberIds = selectedMemberIds;

      const res = await fetch("/api/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        addToast({ type: "success", title: `Notification sent to ${data.data.sentCount} member${data.data.sentCount !== 1 ? "s" : ""}` });
        onClose();
        router.refresh();
      } else {
        const data = await res.json();
        addToast({ type: "error", title: data.error || "Failed to send notification" });
      }
    } catch {
      addToast({ type: "error", title: "Failed to send notification" });
    } finally {
      setSending(false);
      setShowConfirm(false);
    }
  }

  const filteredMembers = allMembers.filter((m) =>
    m.name.toLowerCase().includes(memberSearch.toLowerCase())
  );

  function formatSlotLabel(slot: RecurringSlotOption): string {
    const day = DAY_NAMES[slot.dayOfWeek] || "Unknown";
    const hour = slot.startHour.toString().padStart(2, "0") + ":00";
    return `${day} ${hour}`;
  }

  const audienceOptions: { value: AudienceType; label: string }[] = [
    { value: "ALL", label: "All active members" },
    { value: "TRIAL", label: "Trial members only" },
    { value: "SESSION_SLOT", label: "Members from a session slot" },
    { value: "PAYMENT_STATUS", label: "Members by payment status" },
    { value: "INDIVIDUAL", label: "Select specific members" },
  ];

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Send Notification" size="lg">
        <div className="space-y-5">
          {/* Audience selector */}
          <div>
            <label className="mb-2 block text-sm font-medium text-surface-200">
              Audience
            </label>
            <div className="space-y-2">
              {audienceOptions.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-surface-700 px-4 py-2.5 transition-colors hover:border-surface-600 has-[:checked]:border-primary-500 has-[:checked]:bg-primary-900/10"
                >
                  <input
                    type="radio"
                    name="audience"
                    value={opt.value}
                    checked={audience === opt.value}
                    onChange={() => setAudience(opt.value)}
                    className="accent-primary-500"
                  />
                  <span className="text-sm text-surface-200">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Conditional: session slot picker */}
          {audience === "SESSION_SLOT" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-200">
                Session Slot
              </label>
              <select
                value={slotId}
                onChange={(e) => setSlotId(e.target.value)}
                className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-200 focus:border-primary-500 focus:outline-none"
              >
                <option value="">Select a slot...</option>
                {recurringSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {formatSlotLabel(slot)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Conditional: payment status picker */}
          {audience === "PAYMENT_STATUS" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-200">
                Payment Status
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as "GRACE_PERIOD" | "LOCKED")}
                className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-200 focus:border-primary-500 focus:outline-none"
              >
                <option value="GRACE_PERIOD">Grace Period</option>
                <option value="LOCKED">Locked</option>
              </select>
            </div>
          )}

          {/* Conditional: individual member picker */}
          {audience === "INDIVIDUAL" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-200">
                Select Members
              </label>
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search members..."
                className="mb-2 w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-200 placeholder:text-surface-500 focus:border-primary-500 focus:outline-none"
              />
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-surface-700 p-2">
                {filteredMembers.length === 0 ? (
                  <p className="py-2 text-center text-xs text-surface-500">
                    {loadingRecipients ? "Loading..." : "No members found"}
                  </p>
                ) : (
                  filteredMembers.map((member) => (
                    <label
                      key={member.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-surface-200 hover:bg-surface-700"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMemberIds.includes(member.id)}
                        onChange={() => toggleMember(member.id)}
                        className="accent-primary-500"
                      />
                      {member.name}
                    </label>
                  ))
                )}
              </div>
              {selectedMemberIds.length > 0 && (
                <p className="mt-1 text-xs text-surface-400">
                  {selectedMemberIds.length} selected
                </p>
              )}
            </div>
          )}

          {/* Recipient count */}
          {audience !== "INDIVIDUAL" && (
            <p className="text-sm text-surface-400">
              {loadingRecipients
                ? "Counting recipients..."
                : `Will notify ${recipientCount} member${recipientCount !== 1 ? "s" : ""}`}
            </p>
          )}

          {/* Title */}
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-200">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Studio closed this Friday"
              maxLength={MAX_BROADCAST_TITLE_LENGTH}
              className="w-full rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-200 placeholder:text-surface-500 focus:border-primary-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-surface-500">
              {title.length}/{MAX_BROADCAST_TITLE_LENGTH}
            </p>
          </div>

          {/* Message body */}
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-200">
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message here..."
              maxLength={MAX_BROADCAST_BODY_LENGTH}
              rows={4}
              className="w-full resize-none rounded-lg border border-surface-700 bg-surface-800 px-3 py-2 text-sm text-surface-200 placeholder:text-surface-500 focus:border-primary-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-surface-500">
              {body.length}/{MAX_BROADCAST_BODY_LENGTH}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowConfirm(true)}
              disabled={!canSend}
            >
              Send Notification
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleSend}
        title="Confirm Send"
        message={`Send this notification to ${effectiveCount} member${effectiveCount !== 1 ? "s" : ""}?`}
        confirmLabel="Send"
        loading={sending}
      />
    </>
  );
}
