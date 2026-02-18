/**
 * Generate Sessions API
 *
 * POST /api/sessions/generate-week
 * Generates sessions for a specific week from all recurring slots.
 * Owner only. Idempotent (safe to call multiple times).
 */

import { auth } from "@/lib/auth";
import { generateSessionsForWeek, getWeekStart } from "@/lib/session-generation";
import { z } from "zod";
import { authWriteLimiter, createRateLimitResponse } from "@/lib/rate-limit";

const GenerateSchema = z.object({
  weekDate: z.string().date("Must be a valid date (YYYY-MM-DD)"),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if ((session.user.role as string) !== "OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limit: 30 write requests per minute per user
    const writeRateCheck = authWriteLimiter.check(`write:${session.user.id}`);
    if (!writeRateCheck.allowed) return createRateLimitResponse(writeRateCheck.retryAfterMs);

    const body = await req.json();
    const parsed = GenerateSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const weekDate = getWeekStart(new Date(parsed.data.weekDate));
    const created = await generateSessionsForWeek(weekDate);

    return Response.json({
      data: {
        weekDate: weekDate.toISOString(),
        createdCount: created.length,
        sessions: created,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/sessions/generate-week error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
