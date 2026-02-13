import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPaymentStatus } from "@/lib/payment-logic";
import type { PaymentRecord } from "@/lib/payment-logic";
import { MemberTable } from "@/components/member/MemberTable";
import type { PaymentStatus } from "@/lib/constants";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export const metadata = {
  title: "Members - Wonder Woman Fitness",
};

export default async function OwnerMembersPage(): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user || (session.user.role as string) !== "OWNER") {
    redirect("/login");
  }

  const [members, payments] = await Promise.all([
    prisma.user.findMany({
      where: { role: "MEMBER", status: { not: "DEPARTED" } },
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
      },
      orderBy: { name: "asc" },
    }),
    prisma.payment.findMany({
      select: {
        userId: true,
        periodStart: true,
        periodEnd: true,
        paidAt: true,
      },
    }),
  ]);

  const now = new Date();

  const membersWithStatus = members.map((member) => {
    const memberPayments: PaymentRecord[] = payments
      .filter((p) => p.userId === member.id)
      .map((p) => ({
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        paidAt: p.paidAt,
      }));

    const paymentStatus: PaymentStatus = getPaymentStatus(
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
      email: member.email,
      phone: member.phone,
      photo: member.photo,
      status: member.status,
      joinDate: member.joinDate,
      trialEndsAt: member.trialEndsAt,
      paymentStatus,
    };
  });

  const trialCount = membersWithStatus.filter((m) => m.status === "TRIAL").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">Members</h1>
          <p className="mt-1 text-sm text-surface-400">
            {membersWithStatus.length} active member{membersWithStatus.length !== 1 ? "s" : ""}
            {trialCount > 0 && ` (${trialCount} on trial)`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/members/inactive">
            <Button variant="ghost" size="sm">Inactive</Button>
          </Link>
          <Link href="/members/trial">
            <Button variant="ghost" size="sm">Trials ({trialCount})</Button>
          </Link>
        </div>
      </div>

      <MemberTable members={membersWithStatus} basePath="/members" />
    </div>
  );
}
