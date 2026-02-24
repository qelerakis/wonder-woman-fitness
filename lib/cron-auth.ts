/**
 * Timing-safe cron route authentication.
 *
 * Uses crypto.timingSafeEqual to prevent timing attacks
 * on the CRON_SECRET bearer token comparison.
 */
import { timingSafeEqual } from "crypto";

export function verifyCronSecret(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET is not configured. Rejecting cron request.");
    return false;
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${cronSecret}`;

  if (authHeader.length !== expected.length) return false;

  return timingSafeEqual(
    Buffer.from(authHeader),
    Buffer.from(expected)
  );
}
