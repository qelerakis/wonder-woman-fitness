/**
 * Notification Detail API — PATCH mark read
 *
 * PATCH /api/notifications/[id] — Mark a notification as read
 */

import { auth } from "@/lib/auth";
import { markNotificationRead } from "@/lib/notifications";
import { authWriteLimiter, createRateLimitResponse } from "@/lib/rate-limit";

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

    // Rate limit: 30 write requests per minute per user
    const writeRateCheck = authWriteLimiter.check(`write:${session.user.id}`);
    if (!writeRateCheck.allowed) return createRateLimitResponse(writeRateCheck.retryAfterMs);

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
