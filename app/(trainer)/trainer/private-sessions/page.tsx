import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PrivateSessionsClient } from "@/app/(owner)/private-sessions/PrivateSessionsClient";

export const metadata = {
  title: "Private Sessions - Wonder Woman Fitness",
};

export default async function TrainerPrivateSessionsPage(): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user || (session.user.role as string) !== "TRAINER") {
    redirect("/login");
  }

  // Trainers see only their own private sessions
  const privateSessions = await prisma.privateSession.findMany({
    where: { createdById: session.user.id },
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

  const totalRevenue = privateSessions.reduce(
    (sum, ps) => (ps.paid ? sum + Number(ps.amount) : sum),
    0
  );
  const thisMonthRevenue = privateSessions
    .filter((ps) => ps.paid && new Date(ps.scheduledAt) >= thisMonthStart)
    .reduce((sum, ps) => sum + Number(ps.amount), 0);
  const unpaidCount = privateSessions.filter((ps) => !ps.paid).length;

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
    />
  );
}
