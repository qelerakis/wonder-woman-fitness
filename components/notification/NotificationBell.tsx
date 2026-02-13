"use client";

import { useState, useEffect, useCallback } from "react";
import { NOTIFICATION_POLL_INTERVAL_MS } from "@/lib/constants";

interface NotificationBellProps {
  initialCount?: number;
}

/**
 * Self-polling notification bell that fetches unread count.
 * Used as a standalone widget — the Header already has a static bell link.
 * This component adds live polling for the count.
 */
export function NotificationBell({
  initialCount = 0,
}: NotificationBellProps): React.ReactElement {
  const [count, setCount] = useState(initialCount);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?unread=true&countOnly=true");
      if (res.ok) {
        const data: { data: { count: number } } = await res.json();
        setCount(data.data.count);
      }
    } catch {
      // Silently fail — count stays stale, no user disruption
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchCount();

    // Poll interval
    const interval = setInterval(fetchCount, NOTIFICATION_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchCount]);

  if (count === 0) return <></>;

  return (
    <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-error-500 px-1 text-xs font-bold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export type { NotificationBellProps };
