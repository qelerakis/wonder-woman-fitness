import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TrainersClient } from "./TrainersClient";

export const metadata = {
  title: "Trainers - Wonder Woman Fitness",
};

export default async function OwnerTrainersPage(): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user || (session.user.role as string) !== "OWNER") {
    redirect("/login");
  }

  const trainers = await prisma.user.findMany({
    where: { role: "TRAINER" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <TrainersClient
      trainers={trainers.map((t) => ({
        id: t.id,
        name: t.name,
        email: t.email,
        phone: t.phone,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
      }))}
    />
  );
}
