import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PrivateSessionsClient } from "./PrivateSessionsClient";

export const metadata = {
  title: "Private Sessions - Wonder Woman Fitness",
};

export default async function OwnerPrivateSessionsPage(): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user || (session.user.role as string) !== "OWNER") {
    redirect("/login");
  }

  const privateSessions = await prisma.privateSession.findMany({
    orderBy: { scheduledAt: "desc" },
    select: {
      id: true,
      clientName: true,
      scheduledAt: true,
      paid: true,
      amount: true,
      exerciseDetails: true,
      notes: true,
      createdBy: {
        select: { name: true },
      },
    },
    take: 100,
  });

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalRevenue = privateSessions
    .filter((ps) => ps.paid && ps.amount != null)
    .reduce((sum, ps) => sum + Number(ps.amount), 0);
  const thisMonthRevenue = privateSessions
    .filter(
      (ps) => ps.paid && ps.amount != null && new Date(ps.scheduledAt) >= thisMonthStart
    )
    .reduce((sum, ps) => sum + Number(ps.amount), 0);
  const unpaidCount = privateSessions.filter((ps) => !ps.paid).length;

  const trainers = await prisma.user.findMany({
    where: { role: { in: ["TRAINER", "OWNER"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <PrivateSessionsClient
      sessions={privateSessions.map((ps) => ({
        id: ps.id,
        clientName: ps.clientName,
        scheduledAt: ps.scheduledAt.toISOString(),
        paid: ps.paid,
        amount: Number(ps.amount),
        exerciseDetails: ps.exerciseDetails,
        notes: ps.notes,
        createdBy: ps.createdBy.name,
      }))}
      summary={{
        totalRevenue,
        thisMonthRevenue,
        unpaidCount,
        totalSessions: privateSessions.length,
      }}
      trainers={trainers}
      currentUserId={session.user.id}
    />
  );
}
