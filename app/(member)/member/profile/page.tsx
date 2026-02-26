import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProfileClient } from "./ProfileClient";
import { computeProfilePaymentInfo } from "@/lib/profile-payment-info";

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

  const paymentInfo = computeProfilePaymentInfo(
    {
      id: user.id,
      status: user.status as "TRIAL" | "ACTIVE" | "DEPARTED",
      trialEndsAt: user.trialEndsAt,
      departedAt: user.departedAt,
      overrideActive: user.overrideActive,
    },
    user.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      paidAt: p.paidAt,
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
    })),
    new Date()
  );

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
      paymentInfo={paymentInfo}
    />
  );
}
