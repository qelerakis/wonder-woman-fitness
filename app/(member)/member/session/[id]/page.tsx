import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MemberSessionDetailClient } from "./MemberSessionDetailClient";

export const metadata = {
  title: "Session Detail - Wonder Woman Fitness",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MemberSessionDetailPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const authSession = await auth();
  if (!authSession?.user) {
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

  // Find this member's current vote
  const myVote = session.votes.find(
    (v) => v.userId === authSession.user.id
  );

  return (
    <MemberSessionDetailClient
      session={{
        id: session.id,
        weekDate: session.weekDate.toISOString(),
        status: session.status,
        workoutTitle: session.workoutTitle,
        workoutDetails: session.workoutDetails,
        votingEnabled: session.votingEnabled,
        votingDeadline: session.votingDeadline?.toISOString() || new Date().toISOString(),
        recurringSlot: session.recurringSlot ? {
          dayOfWeek: session.recurringSlot.dayOfWeek,
          startHour: session.recurringSlot.startHour,
        } : null,
        customDay: session.customDay,
        customStartHour: session.customStartHour,
        memberNames: session.members.map((m) => m.user.name),
        trainerNames: session.trainers.map((t) => t.user.name),
        totalMembers: session.members.length,
        votesCount: {
          coming: session.votes.filter((v) => v.attending).length,
          notComing: session.votes.filter((v) => !v.attending).length,
        },
      }}
      myVote={myVote ? myVote.attending : null}
      userId={authSession.user.id}
    />
  );
}
