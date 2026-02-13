import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getWeekStart } from "@/lib/session-generation";
import { MemberScheduleClient } from "./MemberScheduleClient";

export const metadata = {
  title: "Schedule - Wonder Woman Fitness",
};

export default async function MemberSchedulePage(): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const weekStart = getWeekStart(new Date());

  return (
    <MemberScheduleClient
      initialWeekStart={weekStart.toISOString()}
      userId={session.user.id}
    />
  );
}
