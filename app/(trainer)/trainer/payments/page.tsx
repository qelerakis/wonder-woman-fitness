import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { startOfMonth, endOfMonth } from "date-fns";
import { getPaymentStatus } from "@/lib/payment-logic";
import type { PaymentRecord } from "@/lib/payment-logic";
import { TrainerPaymentsClient } from "./TrainerPaymentsClient";

export const metadata = {
  title: "Payments - Wonder Woman Fitness",
};

export default async function TrainerPaymentsPage(): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user || (session.user.role as string) !== "TRAINER") {
    redirect("/login");
  }

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [payments, members, allMemberPayments] = await Promise.all([
    prisma.payment.findMany({
      where: {
        paidAt: { gte: monthStart, lte: monthEnd },
      },
      orderBy: { paidAt: "desc" },
      select: {
        id: true,
        amount: true,
        paidAt: true,
        periodStart: true,
        periodEnd: true,
        user: {
          select: { id: true, name: true },
        },
        recordedBy: {
          select: { name: true },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: "MEMBER", status: { not: "DEPARTED" } },
      select: {
        id: true,
        name: true,
        status: true,
        trialEndsAt: true,
        departedAt: true,
        overrideActive: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.payment.findMany({
      where: {
        user: { role: "MEMBER", status: { not: "DEPARTED" } },
      },
      select: {
        userId: true,
        periodStart: true,
        periodEnd: true,
        paidAt: true,
        amount: true,
      },
    }),
  ]);

  // Compute payment status for each member
  const memberStatuses = members.map((member) => {
    const memberPayments: PaymentRecord[] = allMemberPayments
      .filter((p) => p.userId === member.id)
      .map((p) => ({
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        paidAt: p.paidAt,
      }));

    const paymentStatus = getPaymentStatus(
      {
        id: member.id,
        status: member.status as "TRIAL" | "ACTIVE" | "DEPARTED",
        trialEndsAt: member.trialEndsAt,
        departedAt: member.departedAt,
        overrideActive: member.overrideActive,
      },
      memberPayments,
      now
    );

    return {
      id: member.id,
      name: member.name,
      paymentStatus,
    };
  });

  // Summary stats — this month only
  const thisMonthRevenue = payments.reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );

  const paidCount = memberStatuses.filter(
    (m) => m.paymentStatus === "PAID" || m.paymentStatus === "OVERRIDE"
  ).length;
  const unpaidCount = memberStatuses.filter(
    (m) =>
      m.paymentStatus === "GRACE_PERIOD" || m.paymentStatus === "LOCKED"
  ).length;

  return (
    <TrainerPaymentsClient
      payments={payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paidAt: p.paidAt.toISOString(),
        periodStart: p.periodStart.toISOString(),
        periodEnd: p.periodEnd.toISOString(),
        memberName: p.user.name,
        memberId: p.user.id,
        recordedBy: p.recordedBy?.name || null,
      }))}
      members={memberStatuses}
      summary={{
        thisMonthRevenue,
        paidCount,
        unpaidCount,
        totalMembers: members.length,
      }}
      initialMonth={now.getMonth()}
      initialYear={now.getFullYear()}
    />
  );
}
