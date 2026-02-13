import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { NotificationsClient } from "@/components/notification/NotificationsClient";

export const metadata = {
  title: "Notifications - Wonder Woman Fitness",
};

export default async function OwnerNotificationsPage(): Promise<React.ReactElement> {
  const session = await auth();
  if (!session?.user || session.user.role !== "OWNER") {
    redirect("/login");
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      read: true,
      createdAt: true,
    },
    take: 100,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationsClient
      notifications={notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      }))}
      unreadCount={unreadCount}
    />
  );
}
