"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { SendNotificationModal } from "@/components/notification/SendNotificationModal";
import { formatDistanceToNow } from "date-fns";

interface NotificationData {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

interface RecurringSlotOption {
  id: string;
  dayOfWeek: number;
  startHour: number;
}

interface NotificationsClientProps {
  notifications: NotificationData[];
  unreadCount: number;
  isOwner?: boolean;
  recurringSlots?: RecurringSlotOption[];
}

const typeIcons: Record<string, string> = {
  PAYMENT_REMINDER: "\u{1F4B0}",
  LOCKOUT: "\u{1F512}",
  MEMBER_DEPARTED: "\u{1F44B}",
  REJOIN_REQUEST: "\u{1F504}",
  TRIAL_EXPIRING: "\u{23F3}",
  TRIAL_EXPIRED: "\u{231B}",
  CLASS_CANCELLED: "\u{274C}",
  WORKOUT_POSTED: "\u{1F4AA}",
  VOTING_OPENED: "\u{1F5F3}\u{FE0F}",
  MEMBER_MOVED: "\u{1F500}",
  SESSION_DELETED: "\u{1F5D1}\u{FE0F}",
  MANUAL_REMINDER: "\u{1F4E2}",
};

export function NotificationsClient({
  notifications,
  unreadCount,
  isOwner = false,
  recurringSlots = [],
}: NotificationsClientProps): React.ReactElement {
  const router = useRouter();
  const { addToast } = useToast();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);

  const displayed =
    filter === "unread"
      ? notifications.filter((n) => !n.read)
      : notifications;

  async function handleMarkAsRead(notificationId: string): Promise<void> {
    try {
      const res = await fetch(`/api/notifications/${notificationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      });

      if (res.ok) {
        router.refresh();
      }
    } catch {
      addToast({ type: "error", title: "Failed to mark as read" });
    }
  }

  async function handleMarkAllRead(): Promise<void> {
    setLoading(true);
    try {
      const unread = notifications.filter((n) => !n.read);
      await Promise.all(
        unread.map((n) =>
          fetch(`/api/notifications/${n.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ read: true }),
          })
        )
      );
      addToast({ type: "success", title: "All marked as read" });
      router.refresh();
    } catch {
      addToast({ type: "error", title: "Failed to mark all as read" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-surface-400">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
              : "All caught up!"}
          </p>
        </div>
        <div className="flex gap-2">
          {isOwner && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowSendModal(true)}
            >
              Send Notification
            </Button>
          )}
          <Button
            variant={filter === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All ({notifications.length})
          </Button>
          <Button
            variant={filter === "unread" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilter("unread")}
          >
            Unread ({unreadCount})
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              loading={loading}
            >
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* Notifications list */}
      {displayed.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <p className="text-3xl mb-3">{"\u{1F514}"}</p>
            <p className="text-sm text-surface-500">
              {filter === "unread"
                ? "No unread notifications"
                : "No notifications yet"}
            </p>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-surface-700">
            {displayed.map((notification) => (
              <div
                key={notification.id}
                className={`flex items-start gap-3 px-6 py-4 transition-colors ${
                  !notification.read
                    ? "bg-primary-900/10"
                    : "hover:bg-surface-800/50"
                }`}
              >
                {/* Icon */}
                <span className="mt-0.5 text-lg">
                  {typeIcons[notification.type] || "\u{1F4CB}"}
                </span>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-sm font-medium ${
                        !notification.read
                          ? "text-surface-100"
                          : "text-surface-300"
                      }`}
                    >
                      {notification.title}
                    </p>
                    {!notification.read && (
                      <Badge variant="primary" size="sm">
                        New
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-surface-400">
                    {notification.body}
                  </p>
                  <p className="mt-1 text-xs text-surface-500">
                    {formatDistanceToNow(new Date(notification.createdAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>

                {/* Mark as read */}
                {!notification.read && (
                  <button
                    onClick={() => handleMarkAsRead(notification.id)}
                    className="shrink-0 rounded-md px-2 py-1 text-xs text-surface-400 transition-colors hover:bg-surface-700 hover:text-surface-200"
                  >
                    Mark read
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {isOwner && (
        <SendNotificationModal
          isOpen={showSendModal}
          onClose={() => setShowSendModal(false)}
          recurringSlots={recurringSlots}
        />
      )}
    </div>
  );
}
