import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPaymentStatus } from "@/lib/payment-logic";
import type { PaymentRecord } from "@/lib/payment-logic";
import { MemberDetailClient } from "./MemberDetailClient";

export const metadata = {
  title: "Member Detail - Wonder Woman Fitness",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OwnerMemberDetailPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user || (session.user.role as string) !== "OWNER") {
    redirect("/login");
  }

  const { id } = await params;

  const member = await prisma.user.findUnique({
    where: { id, role: "MEMBER" },
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
      departReason: true,
      monthlyRate: true,
      overrideActive: true,
      payments: {
        orderBy: { paidAt: "desc" },
        select: {
          id: true,
          amount: true,
          paidAt: true,
          periodStart: true,
          periodEnd: true,
          notes: true,
          recordedBy: {
            select: { name: true },
          },
        },
      },
    },
  });

  if (!member) {
    notFound();
  }

  const now = new Date();
  const memberPayments: PaymentRecord[] = member.payments.map((p) => ({
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

  return (
    <MemberDetailClient
      member={{
        id: member.id,
        name: member.name,
        email: member.email,
        phone: member.phone,
        photo: member.photo,
        status: member.status,
        joinDate: member.joinDate.toISOString(),
        trialEndsAt: member.trialEndsAt?.toISOString() || null,
        departedAt: member.departedAt?.toISOString() || null,
        departReason: member.departReason,
        monthlyRate: member.monthlyRate ? Number(member.monthlyRate) : null,
        overrideActive: member.overrideActive,
        paymentStatus,
      }}
      payments={member.payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paidAt: p.paidAt.toISOString(),
        periodStart: p.periodStart.toISOString(),
        periodEnd: p.periodEnd.toISOString(),
        notes: p.notes,
        recordedBy: p.recordedBy,
      }))}
      currentUserId={session.user.id}
    />
  );
}
