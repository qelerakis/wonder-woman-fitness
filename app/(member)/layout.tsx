/**
 * Member Layout
 *
 * Wraps all member routes and handles:
 * - Payment lockout enforcement (shows LockoutScreen if locked)
 * - Payment warning banner (shows PaymentBanner during grace period)
 * - Standard member navigation and app shell
 */

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { checkMemberPaymentStatus } from '@/lib/server-payment-check';
import { LockoutScreen } from '@/components/payments/LockoutScreen';
import { PaymentBanner } from '@/components/payments/PaymentBanner';
import { Header } from '@/components/layout/Header';

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 1. Verify authentication
  const session = await auth();
  if (!session) {
    redirect('/login');
  }

  // 2. Verify member role
  if (session.user.role !== 'MEMBER') {
    redirect('/login');
  }

  // 3. Check payment status
  const paymentStatus = await checkMemberPaymentStatus(session.user.id);

  // 4. If locked out, show lockout screen (blocks all app access)
  if (paymentStatus?.status === 'LOCKED') {
    return <LockoutScreen status={paymentStatus} userEmail={session.user.email || ''} />;
  }

  // 5. Normal member experience with optional payment banner
  return (
    <div className="min-h-screen bg-surface">
      <Header />

      {/* Payment warning banner (grace period or override) */}
      {paymentStatus && (
        <PaymentBanner status={paymentStatus} />
      )}

      {/* Main content */}
      <main className={paymentStatus?.status === 'GRACE_PERIOD' || paymentStatus?.status === 'OVERRIDE' ? 'pt-20' : ''}>
        {children}
      </main>
    </div>
  );
}
