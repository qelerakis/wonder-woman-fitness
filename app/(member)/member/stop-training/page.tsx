import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { StopTrainingClient } from "./StopTrainingClient";

export const metadata = {
  title: "Stop Training - Wonder Woman Fitness",
};

export default async function StopTrainingPage(): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <StopTrainingClient
      userId={session.user.id}
      userName={session.user.name}
    />
  );
}
