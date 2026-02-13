"use client";

import { useState, useEffect, useCallback } from "react";
import type { PaymentStatus } from "@/lib/constants";

interface UsePaymentStatusReturn {
  status: PaymentStatus | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching a member's computed payment status.
 *
 * Calls /api/members/[id]/payment-status on mount and provides
 * a refresh function for re-fetching.
 *
 * @param memberId - The user ID to check payment status for
 */
export function usePaymentStatus(memberId: string): UsePaymentStatusReturn {
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!memberId) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/members/${memberId}/payment-status`
      );
      if (res.ok) {
        const data: { data: { status: PaymentStatus } } = await res.json();
        setStatus(data.data.status);
        setError(null);
      } else {
        setError("Failed to load payment status");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  return {
    status,
    loading,
    error,
    refresh: fetchStatus,
  };
}
