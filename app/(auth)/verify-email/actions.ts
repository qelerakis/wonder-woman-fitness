import { prisma } from "@/lib/prisma";
import { addDays } from "date-fns";
import { TRIAL_DAYS } from "@/lib/constants";

interface VerifyResult {
  success: boolean;
  error?: string;
}

export async function verifyEmailToken(token: string): Promise<VerifyResult> {
  try {
    const pending = await prisma.pendingVerification.findUnique({
      where: { token },
    });

    if (!pending) {
      return { success: false, error: "Invalid or expired verification link." };
    }

    if (pending.expiresAt < new Date()) {
      return { success: false, error: "This verification link has expired. Please register again." };
    }

    // Create user and delete pending record in a transaction
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          email: pending.email,
          passwordHash: pending.passwordHash,
          name: pending.name,
          phone: pending.phone,
          role: "MEMBER",
          status: "TRIAL",
          joinDate: now,
          trialEndsAt: addDays(now, TRIAL_DAYS),
        },
      });

      await tx.pendingVerification.delete({
        where: { id: pending.id },
      });
    });

    return { success: true };
  } catch (error) {
    console.error("Email verification error:", error);
    return { success: false, error: "Verification failed. Please try again." };
  }
}
