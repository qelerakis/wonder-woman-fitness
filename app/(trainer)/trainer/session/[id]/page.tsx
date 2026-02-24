import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionDateTime } from "@/lib/session-generation";
import { TrainerSessionDetailClient } from "./TrainerSessionDetailClient";

export const metadata = {
  title: "Session Detail - Wonder Woman Fitness",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TrainerSessionDetailPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const authSession = await auth();
  if (!authSession?.user) {
    redirect("/login");
  }

  const role = authSession.user.role as string;
  if (role !== "TRAINER" && role !== "OWNER") {
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
      attendanceRecords: {
        select: { userId: true, present: true },
      },
    },
  });

  if (!session) {
    notFound();
  }

  const allMembers = await prisma.user.findMany({
    where: { role: "MEMBER", status: { not: "DEPARTED" } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Build vote members list
  // When voting is enabled: use ALL active/trial members (any member can vote)
  // When voting is disabled: use only assigned members
  const voteMembers = session.votingEnabled
    ? allMembers.map((m) => {
        const vote = session.votes.find((v) => v.userId === m.id);
        return {
          userId: m.id,
          name: m.name,
          attending: vote ? vote.attending : null,
        };
      })
    : session.members.map((sm) => {
        const vote = session.votes.find((v) => v.userId === sm.userId);
        return {
          userId: sm.userId,
          name: sm.user.name,
          attending: vote ? vote.attending : null,
        };
      });

  // Compute whether session has started
  const dayOfWeek = session.recurringSlot?.dayOfWeek ?? session.customDay ?? 1;
  const startHour = session.recurringSlot?.startHour ?? session.customStartHour ?? 0;
  const sessionStart = getSessionDateTime(session.weekDate, dayOfWeek, startHour);
  const hasStarted = new Date() >= sessionStart;

  // Build attendance member list: assigned members (voting off) or voted-coming members (voting on)
  // Plus any walk-ins who have attendance records but aren't in the normal lists
  const attendanceMemberMap = new Map<string, { userId: string; name: string; present: boolean | null }>();

  if (session.votingEnabled) {
    // When voting is on: show all who voted "coming"
    for (const vote of session.votes) {
      if (vote.attending) {
        const member = allMembers.find((m) => m.id === vote.userId);
        const record = session.attendanceRecords.find((ar) => ar.userId === vote.userId);
        attendanceMemberMap.set(vote.userId, {
          userId: vote.userId,
          name: member?.name || "Unknown",
          present: record?.present ?? null,
        });
      }
    }
  } else {
    // When voting is off: show assigned members
    for (const sm of session.members) {
      const record = session.attendanceRecords.find((ar) => ar.userId === sm.userId);
      attendanceMemberMap.set(sm.userId, {
        userId: sm.userId,
        name: sm.user.name,
        present: record?.present ?? null,
      });
    }
  }

  // Add walk-ins (people with attendance records not in the above lists)
  for (const ar of session.attendanceRecords) {
    if (!attendanceMemberMap.has(ar.userId)) {
      const member = allMembers.find((m) => m.id === ar.userId);
      attendanceMemberMap.set(ar.userId, {
        userId: ar.userId,
        name: member?.name || "Unknown",
        present: ar.present,
      });
    }
  }

  const attendanceMembers = Array.from(attendanceMemberMap.values());

  return (
    <TrainerSessionDetailClient
      session={{
        id: session.id,
        weekDate: session.weekDate.toISOString(),
        status: session.status,
        workoutTitle: session.workoutTitle,
        workoutDetails: session.workoutDetails,
        votingEnabled: session.votingEnabled,
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
      allMembers={allMembers}
      attendanceMembers={attendanceMembers}
      hasStarted={hasStarted}
    />
  );
}
