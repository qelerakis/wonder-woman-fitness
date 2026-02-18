import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PaymentStatusBadge } from "@/components/payment/PaymentStatusBadge";
import { getPaymentStatus } from "@/lib/payment-logic";
import type { PaymentRecord } from "@/lib/payment-logic";
import Link from "next/link";
import { format, differenceInDays } from "date-fns";

export const metadata = {
  title: "New Members - Wonder Woman Fitness",
};

export default async function TrialMembersPage(): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user || (session.user.role as string) !== "OWNER") {
    redirect("/login");
  }

  const trialMembers = await prisma.user.findMany({
    where: { role: "MEMBER", status: "TRIAL" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      joinDate: true,
      trialEndsAt: true,
      departedAt: true,
      overrideActive: true,
    },
    orderBy: { trialEndsAt: "asc" },
  });

  const payments = await prisma.payment.findMany({
    where: { userId: { in: trialMembers.map((m) => m.id) } },
    select: { userId: true, periodStart: true, periodEnd: true, paidAt: true },
  });

  const now = new Date();

  const membersWithStatus = trialMembers.map((member) => {
    const memberPayments: PaymentRecord[] = payments
      .filter((p) => p.userId === member.id)
      .map((p) => ({ periodStart: p.periodStart, periodEnd: p.periodEnd, paidAt: p.paidAt }));

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

    const daysLeft = member.trialEndsAt
      ? differenceInDays(new Date(member.trialEndsAt), now)
      : null;

    return { ...member, paymentStatus, daysLeft };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">New Members</h1>
          <p className="mt-1 text-sm text-surface-400">
            {membersWithStatus.length} member{membersWithStatus.length !== 1 ? "s" : ""}{" "}
            awaiting first payment
          </p>
        </div>
        <Link href="/members">
          <Button variant="ghost" size="sm">
            ← Back to Members
          </Button>
        </Link>
      </div>

      {membersWithStatus.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <svg
              className="mx-auto mb-3 h-10 w-10 text-surface-600"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
            </svg>
            <p className="text-sm text-surface-500">
              No new members awaiting payment
            </p>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-surface-700">
            {membersWithStatus.map((member) => (
              <Link
                key={member.id}
                href={`/members/${member.id}`}
                className="flex items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-surface-800/80"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-surface-200">
                      {member.name}
                    </p>
                    <PaymentStatusBadge status={member.paymentStatus} />
                  </div>
                  <p className="mt-0.5 text-xs text-surface-400">
                    {member.email}
                    {member.phone && ` · ${member.phone}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-surface-400">
                    Joined{" "}
                    {format(new Date(member.joinDate), "MMM d, yyyy")}
                  </p>
                  {member.trialEndsAt && (
                    <p
                      className={`text-xs ${
                        member.daysLeft !== null && member.daysLeft <= 3
                          ? "text-warning-400"
                          : "text-surface-500"
                      }`}
                    >
                      Payment due by{" "}
                      {format(new Date(member.trialEndsAt), "MMM d, yyyy")}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
