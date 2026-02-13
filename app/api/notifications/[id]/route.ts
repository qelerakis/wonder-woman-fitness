/**
 * Notification Detail API — PATCH mark read
 *
 * PATCH /api/notifications/[id] — Mark a notification as read
 */

import { auth } from "@/lib/auth";
import { markNotificationRead } from "@/lib/notifications";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  _req: Request,
  { params }: RouteParams
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const notification = await markNotificationRead(id, session.user.id);

    if (!notification) {
      return Response.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    return Response.json({ data: notification });
  } catch (error) {
    console.error("PATCH /api/notifications/[id] error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
