import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { PaymentBanner } from "@/components/payment/PaymentBanner";
import { prisma } from "@/lib/prisma";
import { getPaymentStatus } from "@/lib/payment-logic";
import type { PaymentRecord } from "@/lib/payment-logic";

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const role = session.user.role;
  // Any authenticated user can access member pages
  // (Owner and Trainer can too, but they typically access their own pages)

  const notificationCount = await prisma.notification.count({
    where: {
      userId: session.user.id,
      read: false,
    },
  });

  // Compute payment status for MEMBER role to show banner
  let showGraceBanner = false;
  let daysIntoGracePeriod = 0;

  if (role === "MEMBER") {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        status: true,
        trialEndsAt: true,
        departedAt: true,
        overrideActive: true,
      },
    });

    if (user) {
      const payments = await prisma.payment.findMany({
        where: { userId: session.user.id },
        select: { periodStart: true, periodEnd: true, paidAt: true },
      });

      const paymentRecords: PaymentRecord[] = payments.map((p) => ({
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        paidAt: p.paidAt,
      }));

      const paymentStatus = getPaymentStatus(
        {
          id: user.id,
          status: user.status as "TRIAL" | "ACTIVE" | "DEPARTED",
          trialEndsAt: user.trialEndsAt,
          departedAt: user.departedAt,
          overrideActive: user.overrideActive,
        },
        paymentRecords,
        new Date()
      );

      if (paymentStatus === "LOCKED") {
        redirect("/member/locked");
      }

      if (paymentStatus === "GRACE_PERIOD") {
        showGraceBanner = true;
        // Calculate days into grace period (elapsed days)
        const now = new Date();
        let graceStart: Date;
        if (user.status === "TRIAL" && user.trialEndsAt) {
          // Trial-expired: grace starts from trialEndsAt
          graceStart = user.trialEndsAt;
        } else {
          // Active: grace starts from 1st of current month
          graceStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        }
        const msPerDay = 1000 * 60 * 60 * 24;
        daysIntoGracePeriod = Math.floor((now.getTime() - graceStart.getTime()) / msPerDay) + 1;
      }
    }
  }

  return (
    <div className="min-h-screen bg-surface-950">
      <Header
        userName={session.user.name}
        userRole={session.user.role}
        notificationCount={notificationCount}
      />
      {showGraceBanner && (
        <PaymentBanner
          status="GRACE_PERIOD"
          daysIntoGracePeriod={daysIntoGracePeriod}
        />
      )}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
