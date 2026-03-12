"use client";

import { format, formatDistanceToNow } from "date-fns";
import { useTranslations } from "next-intl";
import type { NotificationType } from "@/lib/constants";

interface NotificationItemData {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: Date | string;
}

interface NotificationItemProps {
  notification: NotificationItemData;
  onMarkRead?: (id: string) => void;
}

const typeIcons: Record<string, { icon: React.ReactNode; colorClass: string }> = {
  WORKOUT_POSTED: {
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" clipRule="evenodd" />
      </svg>
    ),
    colorClass: "text-primary-400",
  },
  VOTING_OPENED: {
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
      </svg>
    ),
    colorClass: "text-primary-400",
  },
  CLASS_CANCELLED: {
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
    ),
    colorClass: "text-error-400",
  },
  PAYMENT_REMINDER: {
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
      </svg>
    ),
    colorClass: "text-warning-400",
  },
  LOCKOUT: {
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
      </svg>
    ),
    colorClass: "text-error-400",
  },
  MEMBER_MOVED: {
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
      </svg>
    ),
    colorClass: "text-primary-400",
  },
};

const defaultIcon = {
  icon: (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
    </svg>
  ),
  colorClass: "text-surface-400",
};

function getTimeAgo(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;

  if (diffMs < oneDayMs) {
    return formatDistanceToNow(d, { addSuffix: true });
  }
  return format(d, "MMM d, HH:mm");
}

export function NotificationItem({
  notification,
  onMarkRead,
}: NotificationItemProps): React.ReactElement {
  const t = useTranslations("notifications");
  const { icon, colorClass } = typeIcons[notification.type] || defaultIcon;

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 transition-colors
        ${notification.read ? "opacity-60" : "bg-surface-800/50"}
      `}
    >
      <div className={`mt-0.5 shrink-0 ${colorClass}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm ${
            notification.read
              ? "text-surface-400"
              : "font-medium text-surface-100"
          }`}
        >
          {notification.title}
        </p>
        {notification.body && (
          <p className="mt-0.5 text-xs text-surface-400 line-clamp-2">
            {notification.body}
          </p>
        )}
        <p className="mt-1 text-xs text-surface-500">
          {getTimeAgo(notification.createdAt)}
        </p>
      </div>
      {!notification.read && onMarkRead && (
        <button
          onClick={() => onMarkRead(notification.id)}
          className="mt-1 shrink-0 rounded p-1 text-surface-500 hover:text-surface-300 transition-colors"
          aria-label={t("markAsRead")}
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

export type { NotificationItemProps, NotificationItemData };
