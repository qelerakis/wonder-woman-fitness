import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MAX_CLASS_SIZE } from "@/lib/constants";
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

  // Count all active/trial members for the vote pool
  const totalActiveMembers = await prisma.user.count({
    where: {
      role: "MEMBER",
      status: { in: ["ACTIVE", "TRIAL"] },
    },
  });

  // Count "Coming" votes for this session to check if full
  const comingVoteCount = session.votes.filter((v) => v.attending).length;

  // Check if this member already voted "Coming" on another session on the same day
  const sessionDay = session.recurringSlot?.dayOfWeek ?? session.customDay;
  const hasComingVoteOnSameDay = sessionDay != null
    ? await prisma.vote.findFirst({
        where: {
          userId: authSession.user.id,
          attending: true,
          sessionId: { not: session.id },
          session: {
            weekDate: session.weekDate,
            OR: [
              { recurringSlot: { dayOfWeek: sessionDay } },
              { customDay: sessionDay },
            ],
          },
        },
      }).then((v) => v !== null)
    : false;

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
        totalMembers: totalActiveMembers,
        votesCount: {
          coming: comingVoteCount,
          notComing: session.votes.filter((v) => !v.attending).length,
        },
      }}
      myVote={myVote ? myVote.attending : null}
      userId={authSession.user.id}
      isFull={comingVoteCount >= MAX_CLASS_SIZE}
      hasComingVoteOnSameDay={hasComingVoteOnSameDay}
    />
  );
}
