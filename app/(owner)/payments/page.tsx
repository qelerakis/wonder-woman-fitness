import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPaymentStatus } from "@/lib/payment-logic";
import type { PaymentRecord } from "@/lib/payment-logic";
import { PaymentsClient } from "./PaymentsClient";

export const metadata = {
  title: "Payments - Wonder Woman Fitness",
};

export default async function OwnerPaymentsPage(): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user || (session.user.role as string) !== "OWNER") {
    redirect("/login");
  }

  const [payments, members, allPayments] = await Promise.all([
    prisma.payment.findMany({
      orderBy: { paidAt: "desc" },
      select: {
        id: true,
        amount: true,
        paidAt: true,
        periodStart: true,
        periodEnd: true,
        notes: true,
        user: {
          select: { id: true, name: true },
        },
        recordedBy: {
          select: { name: true },
        },
      },
      take: 100,
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
      select: {
        userId: true,
        periodStart: true,
        periodEnd: true,
        paidAt: true,
        amount: true,
      },
    }),
  ]);

  const now = new Date();

  // Compute payment status for each member
  const memberStatuses = members.map((member) => {
    const memberPayments: PaymentRecord[] = allPayments
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

  // Summary stats
  const totalRevenue = allPayments.reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthRevenue = allPayments
    .filter((p) => new Date(p.paidAt) >= thisMonthStart)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const paidCount = memberStatuses.filter(
    (m) => m.paymentStatus === "PAID" || m.paymentStatus === "OVERRIDE"
  ).length;
  const unpaidCount = memberStatuses.filter(
    (m) =>
      m.paymentStatus === "GRACE_PERIOD" || m.paymentStatus === "LOCKED"
  ).length;

  return (
    <PaymentsClient
      payments={payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paidAt: p.paidAt.toISOString(),
        periodStart: p.periodStart.toISOString(),
        periodEnd: p.periodEnd.toISOString(),
        notes: p.notes,
        memberName: p.user.name,
        memberId: p.user.id,
        recordedBy: p.recordedBy?.name || null,
      }))}
      members={memberStatuses}
      summary={{
        totalRevenue,
        thisMonthRevenue,
        paidCount,
        unpaidCount,
        totalMembers: members.length,
      }}
      currentUserId={session.user.id}
    />
  );
}
