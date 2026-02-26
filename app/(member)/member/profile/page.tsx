import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProfileClient } from "./ProfileClient";
import {
  getPaymentStatus,
  getGracePeriodStart,
  getGracePeriodLength,
  getDaysBetween,
} from "@/lib/payment-logic";
import type { PaymentRecord as PaymentLogicRecord } from "@/lib/payment-logic";
import { addDays } from "date-fns";

export const metadata = {
  title: "Profile - Wonder Woman Fitness",
};

export default async function MemberProfilePage(): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      photo: true,
      status: true,
      joinDate: true,
      trialEndsAt: true,
      departedAt: true,
      overrideActive: true,
      payments: {
        orderBy: { paidAt: "desc" },
        select: {
          id: true,
          amount: true,
          paidAt: true,
          periodStart: true,
          periodEnd: true,
        },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  // Build the payment user shape using structural typing (no need to import PaymentUser)
  const paymentUser = {
    id: user.id,
    status: user.status as "TRIAL" | "ACTIVE" | "DEPARTED",
    trialEndsAt: user.trialEndsAt,
    departedAt: user.departedAt,
    overrideActive: user.overrideActive,
  };

  // Build PaymentRecord array for payment status computation
  const paymentRecords: PaymentLogicRecord[] = user.payments.map((p) => ({
    periodStart: p.periodStart,
    periodEnd: p.periodEnd,
    paidAt: p.paidAt,
  }));

  const today = new Date();

  // Compute payment status
  const paymentStatus = getPaymentStatus(paymentUser, paymentRecords, today);

  // Compute days remaining in grace period (only relevant for GRACE_PERIOD status)
  let daysRemaining: number | null = null;
  if (paymentStatus === "GRACE_PERIOD") {
    const gracePeriodStart = getGracePeriodStart(paymentUser, today);
    const gracePeriodLength = getGracePeriodLength(paymentUser);
    const daysIntoPeriod = getDaysBetween(gracePeriodStart, today);
    daysRemaining = Math.max(0, gracePeriodLength - daysIntoPeriod);
  }

  // Latest payment (already sorted desc by paidAt)
  const latestPayment = user.payments[0] || null;

  // Furthest coverage: payment with the latest periodEnd
  const furthestCoverage = user.payments.length > 0
    ? user.payments.reduce((latest, p) =>
        p.periodEnd.getTime() > latest.periodEnd.getTime() ? p : latest
      )
    : null;

  // Recent payments: last 6 months, serialized
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const recentPayments = user.payments
    .filter((p) => p.paidAt.getTime() >= sixMonthsAgo.getTime())
    .map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      paidAt: p.paidAt.toISOString(),
      periodStart: p.periodStart.toISOString(),
      periodEnd: p.periodEnd.toISOString(),
    }));

  const totalPaymentCount = user.payments.length;

  // Next payment due: day after furthest coverage period ends
  const nextPaymentDue = furthestCoverage
    ? addDays(furthestCoverage.periodEnd, 1).toISOString()
    : null;

  return (
    <ProfileClient
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        photo: user.photo,
        status: user.status,
        joinDate: user.joinDate.toISOString(),
        trialEndsAt: user.trialEndsAt?.toISOString() || null,
      }}
      paymentInfo={{
        status: paymentStatus,
        daysRemaining,
        lastPaymentDate: latestPayment?.paidAt.toISOString() || null,
        paidThroughDate: furthestCoverage?.periodEnd.toISOString() || null,
        nextPaymentDue,
        recentPayments,
        totalPaymentCount,
      }}
    />
  );
}
