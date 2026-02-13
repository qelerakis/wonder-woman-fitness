import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";

/**
 * NextAuth v5 Configuration (Edge-compatible)
 *
 * This file contains the auth config WITHOUT Prisma or bcrypt imports,
 * making it safe to use in Next.js middleware (Edge runtime).
 *
 * The `authorize` function is defined in the full `auth.ts` which
 * re-exports with Prisma-dependent logic.
 */

// Extend the NextAuth types to include our custom fields.
// NOTE: These union types must match USER_ROLES and USER_STATUSES in lib/constants.ts.
// We inline them here instead of importing because this file must be edge-compatible
// (no transitive imports that could pull in Node.js-only modules).
declare module "next-auth" {
  interface User {
    role: "OWNER" | "TRAINER" | "MEMBER";
    status: "TRIAL" | "ACTIVE" | "DEPARTED";
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: "OWNER" | "TRAINER" | "MEMBER";
      status: "TRIAL" | "ACTIVE" | "DEPARTED";
    };
  }
}

export const authConfig = {
  providers: [
    // Credentials provider needs authorize() which uses Prisma.
    // In the edge-compatible config, we provide a dummy provider.
    // The full auth.ts overrides this with the real implementation.
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // This authorize is never called in middleware — only JWT verification runs there.
      // The real authorize is in auth.ts.
      authorize: () => null,
    }),
  ],
  session: {
    strategy: "jwt" as const,
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.status = user.status;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as "OWNER" | "TRAINER" | "MEMBER";
      session.user.status = token.status as "TRIAL" | "ACTIVE" | "DEPARTED";
      return session;
    },
  },
} satisfies NextAuthConfig;
