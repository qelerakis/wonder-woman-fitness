"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { formatDistanceToNow } from "date-fns";

interface NotificationData {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

interface MemberNotificationsClientProps {
  notifications: NotificationData[];
  unreadCount: number;
}

const typeIcons: Record<string, string> = {
  PAYMENT_REMINDER: "💰",
  LOCKOUT: "🔒",
  CLASS_CANCELLED: "❌",
  WORKOUT_POSTED: "💪",
  VOTING_OPENED: "🗳️",
  MEMBER_MOVED: "🔀",
  SESSION_DELETED: "🗑️",
  MANUAL_REMINDER: "📢",
  TRIAL_EXPIRING: "⏳",
  TRIAL_EXPIRED: "⌛",
};

export function MemberNotificationsClient({
  notifications,
  unreadCount,
}: MemberNotificationsClientProps): React.ReactElement {
  const router = useRouter();
  const { addToast } = useToast();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(false);

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
              ? `${unreadCount} unread`
              : "All caught up!"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All
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

      {/* List */}
      {displayed.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <p className="text-3xl mb-3">🔔</p>
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
                <span className="mt-0.5 text-lg">
                  {typeIcons[notification.type] || "📋"}
                </span>
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
    </div>
  );
}
