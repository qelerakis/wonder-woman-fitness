/**
 * Member Detail API — GET, PATCH
 *
 * GET /api/members/[id] — Get single member details
 * PATCH /api/members/[id] — Update member (owner: any field, self: limited fields)
 */

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MemberUpdateSchema } from "@/types";
import { getPaymentStatus } from "@/lib/payment-logic";
import type { PaymentRecord } from "@/lib/payment-logic";
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

    const { id } = await params;
    const role = session.user.role as string;
    const userId = session.user.id;

    // Members can only view their own profile
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
        name: true,
        email: true,
        phone: true,
        status: true,
        role: true,
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
    });

    if (!member) {
      return Response.json({ error: "Member not found" }, { status: 404 });
    }

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
      new Date()
    );

    const { payments: memberPayments, ...memberData } = member;

    return Response.json({
      data: {
        ...memberData,
        paymentStatus,
        payments: role === "OWNER" ? memberPayments : undefined,
      },
    });
  } catch (error) {
    console.error("GET /api/members/[id] error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Schema for owner-level updates (broader permissions)
const OwnerMemberUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
  status: z.enum(["TRIAL", "ACTIVE", "DEPARTED"]).optional(),
  monthlyRate: z.number().positive().optional(),
  overrideActive: z.boolean().optional(),
  departedAt: z.string().datetime().optional(),
  departReason: z.string().optional(),
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

    const { id } = await params;
    const role = session.user.role as string;
    const userId = session.user.id;

    // Members can only update themselves, trainers cannot update members
    if (role === "MEMBER" && userId !== id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (role === "TRAINER") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Rate limit: 30 write requests per minute per user
    const writeRateCheck = authWriteLimiter.check(`write:${session.user.id}`);
    if (!writeRateCheck.allowed) return createRateLimitResponse(writeRateCheck.retryAfterMs);

    const body = await req.json();

    // Owner can update any field, member can only update basic profile
    const schema = role === "OWNER" ? OwnerMemberUpdateSchema : MemberUpdateSchema;
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Check if member exists
    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return Response.json({ error: "Member not found" }, { status: 404 });
    }

    // Check email uniqueness if email is being changed
    const data = parsed.data;
    if (data.email) {
      const emailTaken = await prisma.user.findFirst({
        where: { email: data.email, id: { not: id } },
        select: { id: true },
      });
      if (emailTaken) {
        return Response.json(
          { error: "Email already in use" },
          { status: 409 }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;

    // Owner-only fields
    if (role === "OWNER") {
      const ownerData = data as z.infer<typeof OwnerMemberUpdateSchema>;
      if (ownerData.status !== undefined) updateData.status = ownerData.status;
      if (ownerData.monthlyRate !== undefined) updateData.monthlyRate = ownerData.monthlyRate;
      if (ownerData.overrideActive !== undefined) updateData.overrideActive = ownerData.overrideActive;
      if (ownerData.departedAt !== undefined) updateData.departedAt = new Date(ownerData.departedAt);
      if (ownerData.departReason !== undefined) updateData.departReason = ownerData.departReason;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        monthlyRate: true,
        overrideActive: true,
        photo: true,
      },
    });

    return Response.json({ data: updated });
  } catch (error) {
    console.error("PATCH /api/members/[id] error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
