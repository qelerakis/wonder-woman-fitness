import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DepartedClient } from "./DepartedClient";

export const metadata = {
  title: "Account Deactivated - Wonder Woman Fitness",
};

export default async function DepartedPage(): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <DepartedClient
      userId={session.user.id}
      userName={session.user.name}
    />
  );
}
