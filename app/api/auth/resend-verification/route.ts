import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { addHours } from "date-fns";
import { ResendVerificationSchema } from "@/types";
import {
  VERIFICATION_TOKEN_BYTES,
  VERIFICATION_EXPIRY_HOURS,
  VERIFICATION_MAX_RESENDS,
  VERIFICATION_RESEND_COOLDOWN_MS,
} from "@/lib/constants";
import { publicLimiter, getClientIp, createRateLimitResponse } from "@/lib/rate-limit";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: Request): Promise<Response> {
  try {
    // Rate limit: shared public limiter (10 requests per 15 min per IP)
    const ip = getClientIp(req);
    const rateCheck = publicLimiter.check(`resend-verify:${ip}`);
    if (!rateCheck.allowed) return createRateLimitResponse(rateCheck.retryAfterMs);

    const body: unknown = await req.json();
    const parsed = ResendVerificationSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const normalizedEmail = parsed.data.email.toLowerCase();

    // Look up pending verification record
    const pending = await prisma.pendingVerification.findUnique({
      where: { email: normalizedEmail },
    });

    // Return generic success even when no record exists to prevent email enumeration
    if (!pending || pending.expiresAt < new Date()) {
      return Response.json({
        message: "If an account is pending verification, a new email has been sent.",
      });
    }

    // Enforce cooldown between resends (60 seconds)
    if (pending.lastResentAt) {
      const elapsed = Date.now() - pending.lastResentAt.getTime();
      if (elapsed < VERIFICATION_RESEND_COOLDOWN_MS) {
        return Response.json(
          { error: "Please wait before requesting another email." },
          { status: 429 }
        );
      }
    }

    // Enforce maximum resend attempts
    if (pending.resendCount >= VERIFICATION_MAX_RESENDS) {
      return Response.json(
        { error: "Maximum resend attempts reached. Please register again." },
        { status: 429 }
      );
    }

    // Generate new token and expiry
    const newToken = crypto.randomBytes(VERIFICATION_TOKEN_BYTES).toString("base64url");
    const newExpiry = addHours(new Date(), VERIFICATION_EXPIRY_HOURS);

    // Update the pending record with new token, bump resend count
    await prisma.pendingVerification.update({
      where: { id: pending.id },
      data: {
        token: newToken,
        expiresAt: newExpiry,
        resendCount: pending.resendCount + 1,
        lastResentAt: new Date(),
      },
    });

    // Send the new verification email
    await sendVerificationEmail(normalizedEmail, newToken);

    return Response.json({
      message: "If an account is pending verification, a new email has been sent.",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
