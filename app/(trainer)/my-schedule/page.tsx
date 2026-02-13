import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
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

  return (
    <TrainerScheduleClient
      initialWeekStart={weekStart.toISOString()}
      userId={session.user.id}
    />
  );
}
