/**
 * My Payments API — GET own payment records
 *
 * GET /api/payments/my — Returns the authenticated user's own payment records.
 * Any authenticated user (MEMBER, TRAINER, OWNER) can access this endpoint.
 * Used by the "Show all payments" toggle in PaymentInfoSection.
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authReadLimiter, createRateLimitResponse } from "@/lib/rate-limit";

export async function GET(): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 60 read requests per minute per user
    const readRateCheck = authReadLimiter.check(`read:${session.user.id}`);
    if (!readRateCheck.allowed) return createRateLimitResponse(readRateCheck.retryAfterMs);

    const payments = await prisma.payment.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        amount: true,
        paidAt: true,
        periodStart: true,
        periodEnd: true,
      },
      orderBy: { paidAt: "desc" },
    });

    return Response.json({
      data: payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paidAt: p.paidAt.toISOString(),
        periodStart: p.periodStart.toISOString(),
        periodEnd: p.periodEnd.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Failed to fetch member payments:", error);
    return Response.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    );
  }
}
