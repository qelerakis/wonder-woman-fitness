/**
 * Payment Detail API — GET, PATCH, DELETE
 *
 * GET /api/payments/[id] — Get a single payment record
 * PATCH /api/payments/[id] — Update a payment (owner only)
 * DELETE /api/payments/[id] — Delete a payment (owner only)
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { authReadLimiter, authWriteLimiter, createRateLimitResponse } from "@/lib/rate-limit";

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

    const role = session.user.role as string;
    if (role === "MEMBER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limit: 60 read requests per minute per user
    const readRateCheck = authReadLimiter.check(`read:${session.user.id}`);
    if (!readRateCheck.allowed) return createRateLimitResponse(readRateCheck.retryAfterMs);

    const { id } = await params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        amount: true,
        paidAt: true,
        periodStart: true,
        periodEnd: true,
        notes: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, email: true },
        },
        recordedBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!payment) {
      return Response.json({ error: "Payment not found" }, { status: 404 });
    }

    return Response.json({ data: payment });
  } catch (error) {
    console.error("GET /api/payments/[id] error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

const PaymentUpdateSchema = z.object({
  amount: z.number().positive().optional(),
  paidAt: z.string().datetime().optional(),
  periodStart: z.string().date().optional(),
  periodEnd: z.string().date().optional(),
  notes: z.string().optional(),
});

export async function PATCH(
  req: Request,
  { params }: RouteParams
): Promise<Response> {
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

    const { id } = await params;
    const body = await req.json();
    const parsed = PaymentUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.payment.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return Response.json({ error: "Payment not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.amount !== undefined) updateData.amount = parsed.data.amount;
    if (parsed.data.paidAt !== undefined) updateData.paidAt = new Date(parsed.data.paidAt);
    if (parsed.data.periodStart !== undefined) updateData.periodStart = new Date(parsed.data.periodStart);
    if (parsed.data.periodEnd !== undefined) updateData.periodEnd = new Date(parsed.data.periodEnd);
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

    const updated = await prisma.payment.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        userId: true,
        amount: true,
        paidAt: true,
        periodStart: true,
        periodEnd: true,
        notes: true,
        createdAt: true,
      },
    });

    return Response.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/payments/[id] error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: RouteParams
): Promise<Response> {
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

    const { id } = await params;

    const existing = await prisma.payment.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return Response.json({ error: "Payment not found" }, { status: 404 });
    }

    await prisma.payment.delete({ where: { id } });

    return Response.json({ data: { id } });
  } catch (error) {
    console.error("DELETE /api/payments/[id] error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
