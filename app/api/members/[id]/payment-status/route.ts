/**
 * Payment Status API
 *
 * GET /api/members/[id]/payment-status
 * Computes and returns the current payment status for a member.
 * Available to Owner, Trainer, and the member themselves.
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPaymentStatus } from "@/lib/payment-logic";
import type { PaymentRecord } from "@/lib/payment-logic";
import { authReadLimiter, createRateLimitResponse } from "@/lib/rate-limit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  _req: Request,
  { params }: RouteParams
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const role = session.user.role as string;
    const userId = session.user.id;

    // Members can only check their own status
    if (role === "MEMBER" && userId !== id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limit: 60 read requests per minute per user
    const readRateCheck = authReadLimiter.check(`read:${session.user.id}`);
    if (!readRateCheck.allowed) return createRateLimitResponse(readRateCheck.retryAfterMs);

    const member = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        trialEndsAt: true,
        departedAt: true,
        overrideActive: true,
        payments: {
          select: {
            periodStart: true,
            periodEnd: true,
            paidAt: true,
          },
          orderBy: { paidAt: "desc" },
        },
      },
    });

    if (!member) {
      return Response.json({ error: "Member not found" }, { status: 404 });
    }

    const payments: PaymentRecord[] = member.payments.map((p) => ({
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      paidAt: p.paidAt,
    }));

    const paymentStatus = getPaymentStatus(
      {
        id: member.id,
        status: member.status as "TRIAL" | "ACTIVE" | "DEPARTED",
        trialEndsAt: member.trialEndsAt,
        departedAt: member.departedAt,
        overrideActive: member.overrideActive,
      },
      payments,
      new Date()
    );

    return Response.json({
      data: {
        userId: member.id,
        paymentStatus,
        overrideActive: member.overrideActive,
        trialEndsAt: member.trialEndsAt,
      },
    });
  } catch (error) {
    console.error("GET /api/members/[id]/payment-status error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
