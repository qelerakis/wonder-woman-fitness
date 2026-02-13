import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getWeekStart } from "@/lib/session-generation";
import { TrainerScheduleClient } from "./TrainerScheduleClient";

export const metadata = {
  title: "My Schedule - Wonder Woman Fitness",
};

export default async function TrainerSchedulePage(): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const role = session.user.role as string;
  if (role !== "TRAINER" && role !== "OWNER") {
    redirect("/login");
  }

  const weekStart = getWeekStart(new Date());

  const recurringSlots = await prisma.recurringSlot.findMany({
    orderBy: [{ dayOfWeek: "asc" }, { startHour: "asc" }],
  });

  return (
    <TrainerScheduleClient
      initialWeekStart={weekStart.toISOString()}
      userId={session.user.id}
      recurringSlots={recurringSlots.map((s) => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek,
        startHour: s.startHour,
        trainerName: null,
      }))}
    />
  );
}
