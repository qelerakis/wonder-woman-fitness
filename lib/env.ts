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

export const env = {
  DATABASE_URL: requireEnv("DATABASE_URL"),
  NEXTAUTH_SECRET: requireEnv("NEXTAUTH_SECRET"),
  NEXTAUTH_URL: requireEnv("NEXTAUTH_URL"),
  CRON_SECRET: requireEnv("CRON_SECRET"),
  RESEND_API_KEY: process.env.RESEND_API_KEY ?? null,
  EMAIL_FROM: process.env.EMAIL_FROM ?? "noreply@wonderwomanfitness.mk",
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ?? null,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ?? null,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ?? null,
};
