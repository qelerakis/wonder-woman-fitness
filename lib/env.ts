function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `FATAL: Missing required environment variable: ${name}. ` +
        `Check your .env.local (dev) or Vercel environment variables (production).`
    );
  }
  return value;
}

/**
 * Centralized environment variable access with validation.
 *
 * Uses lazy getters so validation only runs at runtime (when values are
 * actually accessed), NOT at build time. This is critical for Vercel
 * deployments where runtime env vars aren't available during `next build`.
 */
export const env = {
  get DATABASE_URL(): string { return requireEnv("DATABASE_URL"); },
  get NEXTAUTH_SECRET(): string { return requireEnv("NEXTAUTH_SECRET"); },
  get NEXTAUTH_URL(): string { return requireEnv("NEXTAUTH_URL"); },
  get CRON_SECRET(): string { return requireEnv("CRON_SECRET"); },
  get RESEND_API_KEY(): string | null { return process.env.RESEND_API_KEY ?? null; },
  get EMAIL_FROM(): string { return process.env.EMAIL_FROM ?? "noreply@contact.wonderwomanfitness.org"; },
  get CLOUDINARY_CLOUD_NAME(): string | null { return process.env.CLOUDINARY_CLOUD_NAME ?? null; },
  get CLOUDINARY_API_KEY(): string | null { return process.env.CLOUDINARY_API_KEY ?? null; },
  get CLOUDINARY_API_SECRET(): string | null { return process.env.CLOUDINARY_API_SECRET ?? null; },
};
