/**
 * Timing-safe cron route authentication.
 *
 * Uses crypto.timingSafeEqual to prevent timing attacks
 * on the CRON_SECRET bearer token comparison.
 */
import { timingSafeEqual } from "crypto";

export function verifyCronSecret(req: Request): boolean {
  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;

  if (authHeader.length !== expected.length) {
    return false;
  }

  try {
    return timingSafeEqual(
      Buffer.from(authHeader),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}
