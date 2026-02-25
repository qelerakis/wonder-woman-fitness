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
      members: {
        select: {
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
          user: {
            select: {
              name: true,
            },
          },
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

  // Get "Coming" votes for this session
  const comingVotes = session.votes.filter((v) => v.attending);
  const comingVoteCount = comingVotes.length;
  const comingMemberNames = comingVotes.map((v) => v.user.name);

  // Check if this member is assigned to this session
  const isAssigned = session.members.some(
    (m) => m.user.id === authSession.user.id
  );

  // Get assigned member names for non-voting sessions
  const assignedMemberNames = session.members.map((m) => m.user.name);

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
            // Exclude cancelled sessions — votes on them shouldn't block new same-day votes
            status: { not: "CANCELLED" },
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
        trainerNames: session.trainers.map((t) => t.user.name),
        comingMemberNames,
        assignedMemberNames,
        votesCount: {
          coming: comingVoteCount,
        },
      }}
      myVote={myVote ? myVote.attending : null}
      userId={authSession.user.id}
      isFull={comingVoteCount >= MAX_CLASS_SIZE}
      hasComingVoteOnSameDay={hasComingVoteOnSameDay}
      isAssigned={isAssigned}
    />
  );
}
