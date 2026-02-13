import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProfileClient } from "./ProfileClient";

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
    },
  });

  if (!user) {
    redirect("/login");
  }

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
    />
  );
}
