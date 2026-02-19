import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

const { auth } = NextAuth(authConfig);

/**
 * Public routes that don't require authentication.
 * These paths are accessible to all visitors.
 */
const PUBLIC_ROUTES = ["/login", "/register", "/forgot-password", "/check-email", "/verify-email"];

/**
 * API auth routes that must remain public for NextAuth to work.
 */
const PUBLIC_API_PREFIXES = ["/api/auth"];

/**
 * Check if a pathname matches any public route.
 */
function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) {
    return true;
  }
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Role-based route access configuration.
 * Maps route prefixes to the roles allowed to access them.
 *
 * Note: Next.js route groups like (owner), (trainer), (member) do NOT appear
 * in the URL. So app/(owner)/dashboard/page.tsx is served at /dashboard.
 * We list both prefix-based paths AND standalone paths used by role redirects.
 *
 * API routes perform their own role checks (see CLAUDE.md section 4.3).
 */
const ROLE_ROUTE_MAP: Record<string, string[]> = {
  "/owner": ["OWNER"],
  "/dashboard": ["OWNER"],
  "/members": ["OWNER"],
  "/payments": ["OWNER"],
  "/private-sessions": ["OWNER"],
  "/trainers": ["OWNER"],
  "/trainer": ["TRAINER", "OWNER"],
  "/my-schedule": ["TRAINER", "OWNER"],
  "/member": ["MEMBER", "TRAINER", "OWNER"],
};

/**
 * Determine the default redirect path based on user role.
 */
function getDefaultRedirect(role: string): string {
  switch (role) {
    case "OWNER":
      return "/dashboard";
    case "TRAINER":
      return "/my-schedule";
    case "MEMBER":
      return "/member/schedule";
    default:
      return "/login";
  }
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session: Session | null = req.auth;

  // 1. Allow public routes without authentication
  if (isPublicRoute(pathname)) {
    // If already authenticated, redirect away from auth pages
    if (session?.user && PUBLIC_ROUTES.includes(pathname)) {
      const role = session.user.role;
      return NextResponse.redirect(
        new URL(getDefaultRedirect(role), req.url)
      );
    }
    return NextResponse.next();
  }

  // 2. Redirect unauthenticated users to login
  if (!session?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const userRole = session.user.role;
  const userStatus = session.user.status;

  // 3. Handle departed members — they can only see /member/departed
  if (userStatus === "DEPARTED" && !pathname.startsWith("/member/departed")) {
    return NextResponse.redirect(new URL("/member/departed", req.url));
  }

  // 4. Role-based access control
  for (const [routePrefix, allowedRoles] of Object.entries(ROLE_ROUTE_MAP)) {
    if (pathname.startsWith(routePrefix)) {
      if (!allowedRoles.includes(userRole)) {
        // Redirect to the user's default page instead of login
        return NextResponse.redirect(
          new URL(getDefaultRedirect(userRole), req.url)
        );
      }
      break;
    }
  }

  // 5. Payment lockout for MEMBER role
  //
  // ARCHITECTURE DECISION: Payment status cannot be computed in middleware because:
  // - NextAuth middleware runs on the Edge runtime (no Prisma/DB access)
  // - getPaymentStatus() requires DB queries (user + payment records)
  //
  // Strategy: Payment lockout is enforced in the member layout (Server Component)
  // which has full access to Prisma. The layout calls getPaymentStatus() and
  // renders LockoutScreen if status === "LOCKED". This provides the same UX
  // (member sees lockout screen) without requiring edge-compatible DB access.
  //
  // The JWT token carries the user's `status` field (TRIAL/ACTIVE/DEPARTED)
  // which is used above for departed member redirect. But LOCKED is a computed
  // payment status, not a stored status, so it cannot be in the JWT.
  //
  // Alternative considered: Caching payment status in the JWT token on login
  // and token refresh. Rejected because it would go stale between refreshes,
  // and a member who pays should be unlocked immediately without re-login.

  // 6. Root path redirect based on role
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(getDefaultRedirect(userRole), req.url)
    );
  }

  return NextResponse.next();
});

/**
 * Middleware matcher configuration.
 * Excludes static files, images, and Next.js internals.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (browser favicon)
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
