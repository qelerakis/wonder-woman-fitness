import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { addDays } from "date-fns";
import { RegisterSchema } from "@/types";
import { BCRYPT_ROUNDS, TRIAL_DAYS } from "@/lib/constants";
import { publicLimiter, getClientIp, createRateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: Request): Promise<Response> {
  try {
    // Rate limit: 10 requests per 15 min per IP (OWASP brute-force mitigation)
    const ip = getClientIp(req);
    const rateCheck = publicLimiter.check(`register:${ip}`);
    if (!rateCheck.allowed) return createRateLimitResponse(rateCheck.retryAfterMs);

    const body: unknown = await req.json();
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, phone, email, password } = parsed.data;

    // Hash password first to ensure constant-time response regardless of
    // whether the email exists (prevents timing-based email enumeration)
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });

    if (existingUser) {
      return Response.json(
        { error: "Registration failed. Please try again or contact support." },
        { status: 400 }
      );
    }

    // Create user with TRIAL status
    const now = new Date();
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name,
        phone: phone || null,
        role: "MEMBER",
        status: "TRIAL",
        joinDate: now,
        trialEndsAt: addDays(now, TRIAL_DAYS),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
      },
    });

    return Response.json({ data: user }, { status: 201 });
  } catch (error) {
    console.error("Registration error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
