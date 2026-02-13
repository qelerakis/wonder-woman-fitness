import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LockoutScreen } from "@/components/payment/LockoutScreen";

export const metadata = {
  title: "Account Locked - Wonder Woman Fitness",
};

export default async function LockedPage(): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
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
