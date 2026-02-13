import { format } from "date-fns";
import { Card, CardHeader } from "@/components/ui/Card";

interface PaymentRecord {
  id: string;
  amount: number;
  paidAt: Date | string;
  periodStart: Date | string;
  periodEnd: Date | string;
  notes: string | null;
  recordedBy?: {
    name: string;
  };
}

interface PaymentHistoryProps {
  payments: PaymentRecord[];
  showRecordedBy?: boolean;
}

function formatDate(date: Date | string): string {
  return format(new Date(date), "MMM d, yyyy");
}

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString()} MKD`;
}

export function PaymentHistory({
  payments,
  showRecordedBy = false,
}: PaymentHistoryProps): React.ReactElement {
  if (payments.length === 0) {
    return (
      <Card>
        <div className="py-8 text-center">
          <svg
            className="mx-auto mb-3 h-10 w-10 text-surface-600"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm text-surface-500">No payments recorded yet</p>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="none">
      <div className="px-6 py-4">
        <CardHeader title="Payment History" />
      </div>
      <div className="divide-y divide-surface-700">
        {payments.map((payment) => (
          <div
            key={payment.id}
            className="flex items-center justify-between gap-4 px-6 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-surface-200">
                {formatCurrency(payment.amount)}
              </p>
              <p className="text-xs text-surface-400">
                {formatDate(payment.periodStart)} – {formatDate(payment.periodEnd)}
              </p>
              {payment.notes && (
                <p className="mt-0.5 text-xs text-surface-500 truncate">
                  {payment.notes}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs text-surface-400">
                {formatDate(payment.paidAt)}
              </p>
              {showRecordedBy && payment.recordedBy && (
                <p className="text-xs text-surface-500">
                  by {payment.recordedBy.name}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export type { PaymentHistoryProps, PaymentRecord };
