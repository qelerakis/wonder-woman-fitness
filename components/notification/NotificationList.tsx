"use client";

import { useTranslations } from "next-intl";
import { NotificationItem } from "./NotificationItem";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import type { NotificationItemData } from "./NotificationItem";

interface NotificationListProps {
  notifications: NotificationItemData[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  loading?: boolean;
}

export function NotificationList({
  notifications,
  onMarkRead,
  onMarkAllRead,
  loading = false,
}: NotificationListProps): React.ReactElement {
  const t = useTranslations("notifications");
  const unreadCount = notifications.filter((n) => !n.read).length;

  if (notifications.length === 0) {
    return (
      <Card>
        <div className="py-12 text-center">
          <svg
            className="mx-auto mb-3 h-10 w-10 text-surface-600"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
          </svg>
          <p className="text-sm text-surface-500">{t("noNotificationsYet")}</p>
          <p className="mt-1 text-xs text-surface-600">
            {t("noNotificationsDescription")}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="none">
      <div className="flex items-center justify-between px-6 py-4">
        <CardHeader
          title={t("title")}
          description={
            unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
              : t("allCaughtUpClean")
          }
        />
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkAllRead}
            loading={loading}
          >
            {t("markAllReadShort")}
          </Button>
        )}
      </div>
      <div className="divide-y divide-surface-700/50">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onMarkRead={onMarkRead}
          />
        ))}
      </div>
    </Card>
  );
}

export type { NotificationListProps };
