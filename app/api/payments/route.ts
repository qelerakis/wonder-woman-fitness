/**
 * Payments API — GET list, POST record
 *
 * GET /api/payments — Owner: all payments (filterable). Trainer: read-only status view.
 * POST /api/payments — Owner records a cash payment.
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PaymentSchema } from "@/types";

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role as string;

    if (role === "MEMBER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    const where: Record<string, unknown> = {};

    if (userId) {
      where.userId = userId;
    }

    if (startDate || endDate) {
      where.paidAt = {};
      if (startDate) {
        const parsedStart = new Date(startDate);
        if (isNaN(parsedStart.getTime())) {
          return Response.json({ error: "Invalid startDate format" }, { status: 400 });
        }
        (where.paidAt as Record<string, unknown>).gte = parsedStart;
      }
      if (endDate) {
        const parsedEnd = new Date(endDate);
        if (isNaN(parsedEnd.getTime())) {
          return Response.json({ error: "Invalid endDate format" }, { status: 400 });
        }
        (where.paidAt as Record<string, unknown>).lte = parsedEnd;
      }
    }

    const payments = await prisma.payment.findMany({
      where,
      select: {
        id: true,
        userId: true,
        amount: true,
        paidAt: true,
        periodStart: true,
        periodEnd: true,
        notes: role === "OWNER" ? true : false,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            ...(role === "OWNER" && { email: true }),
          },
        },
        recordedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { paidAt: "desc" },
    });

    return Response.json({ data: payments });
  } catch (error) {
    console.error("GET /api/payments error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if ((session.user.role as string) !== "OWNER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = PaymentSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { userId, amount, paidAt, periodStart, periodEnd, notes } = parsed.data;

    // Verify the member exists
    const member = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!member) {
      return Response.json({ error: "Member not found" }, { status: 404 });
    }

    if (member.role !== "MEMBER") {
      return Response.json(
        { error: "Payments can only be recorded for members" },
        { status: 400 }
      );
    }

    // Record payment in a transaction (per CLAUDE.md section 7)
    const payment = await prisma.$transaction(async (tx) => {
      return tx.payment.create({
        data: {
          userId,
          amount,
          paidAt: new Date(paidAt),
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
          notes,
          recordedById: session.user.id,
        },
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
            select: { id: true, name: true },
          },
        },
      });
    });

    return Response.json({ data: payment }, { status: 201 });
  } catch (error) {
    console.error("POST /api/payments error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
