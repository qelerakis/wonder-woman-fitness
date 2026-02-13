import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SessionDetailClient } from "./SessionDetailClient";

export const metadata = {
  title: "Session Detail - Wonder Woman Fitness",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OwnerSessionDetailPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const authSession = await auth();
  if (!authSession?.user || (authSession.user.role as string) !== "OWNER") {
    redirect("/login");
  }

  const { id } = await params;

  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      recurringSlot: true,
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
            },
          },
        },
      },
      trainers: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      votes: {
        select: {
          id: true,
          userId: true,
          attending: true,
          votedAt: true,
        },
      },
    },
  });

  if (!session) {
    notFound();
  }

  // Get all trainers and members for assignment modals
  const [allTrainers, allMembers] = await Promise.all([
    prisma.user.findMany({
      where: { role: "TRAINER", status: { not: "DEPARTED" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "MEMBER", status: { not: "DEPARTED" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Build vote members list (all assigned members with their vote status)
  const voteMembers = session.members.map((sm) => {
    const vote = session.votes.find((v) => v.userId === sm.userId);
    return {
      userId: sm.userId,
      name: sm.user.name,
      attending: vote ? vote.attending : null,
    };
  });

  // Serialize dates for client
  return (
    <SessionDetailClient
      session={{
        id: session.id,
        weekDate: session.weekDate.toISOString(),
        status: session.status,
        workoutTitle: session.workoutTitle,
        workoutDetails: session.workoutDetails,
        votingEnabled: session.votingEnabled,
        recurringSlotId: session.recurringSlotId,
        recurringSlot: session.recurringSlot ? {
          dayOfWeek: session.recurringSlot.dayOfWeek,
          startHour: session.recurringSlot.startHour,
        } : null,
        customDay: session.customDay,
        customStartHour: session.customStartHour,
        members: session.members.map((m) => ({
          userId: m.userId,
          name: m.user.name,
          email: m.user.email,
          status: m.user.status,
        })),
        trainers: session.trainers.map((t) => ({
          userId: t.userId,
          name: t.user.name,
          email: t.user.email,
        })),
      }}
      voteMembers={voteMembers}
      allTrainers={allTrainers}
      allMembers={allMembers}
    />
  );
}
