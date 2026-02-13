import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getWeekStart } from "@/lib/session-generation";
import { ScheduleClient } from "./ScheduleClient";

export const metadata = {
  title: "Schedule - Wonder Woman Fitness",
};

export default async function OwnerSchedulePage(): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user || (session.user.role as string) !== "OWNER") {
    redirect("/login");
  }

  // Get recurring slots for the create modal
  const recurringSlots = await prisma.recurringSlot.findMany({
    orderBy: [{ dayOfWeek: "asc" }, { startHour: "asc" }],
  });

  // Get all trainers for assignment
  const trainers = await prisma.user.findMany({
    where: { role: "TRAINER" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  // Get all active members for assignment
  const members = await prisma.user.findMany({
    where: { role: "MEMBER", status: { not: "DEPARTED" } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  const weekStart = getWeekStart(new Date());

  return (
    <ScheduleClient
      initialWeekStart={weekStart.toISOString()}
      recurringSlots={recurringSlots.map((s) => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        startHour: s.startHour,
        trainerName: null,
      }))}
      trainers={trainers}
      members={members}
    />
  );
}
