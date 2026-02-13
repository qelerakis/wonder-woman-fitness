/**
 * Members API — GET list
 *
 * GET /api/members
 * - Owner: all members with computed payment status
 * - Trainer: read-only member list (name, status)
 * - Member: forbidden (403)
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPaymentStatus } from "@/lib/payment-logic";
import type { PaymentRecord } from "@/lib/payment-logic";

export async function GET(): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role as string;

    if (role === "MEMBER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const members = await prisma.user.findMany({
      where: { role: "MEMBER" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        joinDate: true,
        trialEndsAt: true,
        departedAt: true,
        departReason: true,
        monthlyRate: true,
        overrideActive: true,
        photo: true,
        payments: {
          select: {
            id: true,
            amount: true,
            paidAt: true,
            periodStart: true,
            periodEnd: true,
            notes: true,
            createdAt: true,
          },
          orderBy: { paidAt: "desc" },
        },
      },
      orderBy: { name: "asc" },
    });

    const today = new Date();

    const membersWithStatus = members.map((member) => {
      const paymentRecords: PaymentRecord[] = member.payments.map((p) => ({
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
        paymentRecords,
        today
      );

      // Trainers get limited info
      if (role === "TRAINER") {
        return {
          id: member.id,
          name: member.name,
          email: member.email,
          status: member.status,
          paymentStatus,
          photo: member.photo,
        };
      }

      // Owner gets full info
      const { payments: _payments, ...memberData } = member;
      return {
        ...memberData,
        paymentStatus,
      };
    });

    return Response.json({ data: membersWithStatus });
  } catch (error) {
    console.error("GET /api/members error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
