import crypto from "crypto";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { addHours } from "date-fns";
import { RegisterSchema } from "@/types";
import { BCRYPT_ROUNDS, VERIFICATION_TOKEN_BYTES, VERIFICATION_EXPIRY_HOURS, EMAIL_FROM } from "@/lib/constants";
import { publicLimiter, getClientIp, createRateLimitResponse } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: Request): Promise<Response> {
  try {
    console.log("[REGISTER] === Route handler entered ===");

    // Rate limit: 10 requests per 15 min per IP
    const ip = getClientIp(req);
    const rateCheck = publicLimiter.check(`register:${ip}`);
    if (!rateCheck.allowed) {
      console.log("[REGISTER] Rate limited");
      return createRateLimitResponse(rateCheck.retryAfterMs);
    }

    const body: unknown = await req.json();
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      console.log("[REGISTER] Validation failed:", parsed.error.flatten().fieldErrors);
      return Response.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, phone, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();
    console.log(`[REGISTER] Processing registration for: ${normalizedEmail}`);

    // Hash password first to ensure constant-time response regardless of
    // whether the email exists (prevents timing-based email enumeration)
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    console.log("[REGISTER] Password hashed");

    // Check if email already exists as a confirmed User
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      console.log(`[REGISTER] Email already exists as confirmed user`);
      return Response.json(
        { error: "Registration failed. Please try again or contact support." },
        { status: 400 }
      );
    }
    console.log("[REGISTER] No existing user found — proceeding");

    // Generate verification token
    const token = crypto.randomBytes(VERIFICATION_TOKEN_BYTES).toString("base64url");
    const expiresAt = addHours(new Date(), VERIFICATION_EXPIRY_HOURS);

    // Upsert: replaces any existing pending record for this email (lazy cleanup)
    await prisma.pendingVerification.upsert({
      where: { email: normalizedEmail },
      update: {
        passwordHash,
        name,
        phone: phone || null,
        token,
        expiresAt,
        resendCount: 0,
        lastResentAt: null,
      },
      create: {
        email: normalizedEmail,
        passwordHash,
        name,
        phone: phone || null,
        token,
        expiresAt,
      },
    });
    console.log("[REGISTER] PendingVerification upserted");

    // Diagnostic: log env state before email send
    console.log(`[REGISTER] RESEND_API_KEY set: ${!!process.env.RESEND_API_KEY}`);
    console.log(`[REGISTER] NEXTAUTH_URL: ${process.env.NEXTAUTH_URL}`);
    console.log(`[REGISTER] EMAIL_FROM: ${EMAIL_FROM}`);

    // Send verification email — must await so the serverless function
    // stays alive long enough for the Resend API call to complete.
    // Email failure is logged but does not block registration.
    console.log(`[REGISTER] Calling sendVerificationEmail...`);
    const emailSent = await sendVerificationEmail(normalizedEmail, token);
    console.log(`[REGISTER] sendVerificationEmail returned: ${emailSent}`);
    if (!emailSent) {
      console.error(`[REGISTER] Verification email was NOT sent to ${normalizedEmail}`);
    }

    return Response.json(
      { message: "Verification email sent. Please check your inbox." },
      { status: 201 }
    );
  } catch (error) {
    console.error("[REGISTER] Unhandled error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
