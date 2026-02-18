/**
 * Notifications API — GET list
 *
 * GET /api/notifications — Get user's notifications
 * Query params:
 *   unread=true — only unread notifications
 *   limit=N — number of notifications to return (default 50)
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { markAllNotificationsRead } from "@/lib/notifications";
import { authReadLimiter, authWriteLimiter, createRateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 60 read requests per minute per user
    const readRateCheck = authReadLimiter.check(`read:${session.user.id}`);
    if (!readRateCheck.allowed) return createRateLimitResponse(readRateCheck.retryAfterMs);

    const url = new URL(req.url);
    const unreadOnly = url.searchParams.get("unread") === "true";
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "50", 10),
      100
    );

    const where: Record<string, unknown> = {
      userId: session.user.id,
    };

    if (unreadOnly) {
      where.read = false;
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          read: true,
          emailSent: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({
        where: { userId: session.user.id, read: false },
      }),
    ]);

    return Response.json({
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications/mark-all-read
 * Using POST on the collection route with action query param
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 30 write requests per minute per user
    const writeRateCheck = authWriteLimiter.check(`write:${session.user.id}`);
    if (!writeRateCheck.allowed) return createRateLimitResponse(writeRateCheck.retryAfterMs);

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "mark-all-read") {
      const count = await markAllNotificationsRead(session.user.id);
      return Response.json({ data: { markedRead: count } });
    }

    return Response.json(
      { error: "Unknown action. Supported: mark-all-read" },
      { status: 400 }
    );
  } catch (error) {
    console.error("POST /api/notifications error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
