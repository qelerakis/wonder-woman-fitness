import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPaymentStatus } from "@/lib/payment-logic";
import type { PaymentRecord } from "@/lib/payment-logic";
import { LockoutScreen } from "@/components/payment/LockoutScreen";

export const metadata = {
  title: "Account Locked - Wonder Woman Fitness",
};

export default async function LockedPage(): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Non-members should not see this page — redirect to their default page
  if (session.user.role === "OWNER") {
    redirect("/dashboard");
  }
  if (session.user.role === "TRAINER") {
    redirect("/my-schedule");
  }

  // Verify the member is actually locked — if they've paid, redirect them back
  if (session.user.role === "MEMBER") {
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

      // If member is no longer locked, send them to their schedule
      if (paymentStatus !== "LOCKED") {
        redirect("/member/schedule");
      }
    }
  }

  // Get the owner email for contact info
  const owner = await prisma.user.findFirst({
    where: { role: "OWNER" },
    select: { email: true },
  });

  return (
    <div className="min-h-screen bg-surface-950">
      <LockoutScreen
        memberName={session.user.name}
        ownerEmail={owner?.email}
      />
    </div>
  );
}
