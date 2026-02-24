import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authWriteLimiter, createRateLimitResponse } from "@/lib/rate-limit";

export async function POST(): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 30 write requests per minute per user
    const writeRateCheck = authWriteLimiter.check(`write:${session.user.id}`);
    if (!writeRateCheck.allowed) return createRateLimitResponse(writeRateCheck.retryAfterMs);

    const result = await prisma.notification.updateMany({
      where: {
        userId: session.user.id,
        read: false,
      },
      data: { read: true },
    });

    return Response.json({ data: { count: result.count } });
  } catch (error) {
    console.error("Failed to mark all notifications as read:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
