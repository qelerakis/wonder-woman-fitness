"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
        setLoading(false);
        return;
      }

      // Fetch session to determine role-based redirect
      // credentials: "include" ensures auth cookies are sent with the request
      const res = await fetch("/api/auth/session", {
        credentials: "include",
      });
      const session = await res.json();

      if (session?.user?.role === "OWNER") {
        router.push("/dashboard");
      } else if (session?.user?.role === "TRAINER") {
        router.push("/my-schedule");
      } else {
        router.push("/member/schedule");
      }
    } catch {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  }

  return (
    <>
      <h2 className="mb-6 text-center text-2xl font-semibold text-surface-100">
        Sign In
      </h2>

      {error && (
        <div className="mb-4 rounded-lg bg-error-50 p-3 text-sm text-error-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-surface-300"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-surface-600 bg-surface-800 px-4 py-2.5 text-surface-100 placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-surface-300"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-surface-600 bg-surface-800 px-4 py-2.5 text-surface-100 placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Enter your password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-surface-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <div className="mt-6 space-y-2 text-center text-sm">
        <p className="text-surface-400">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-primary-400 hover:text-primary-300"
          >
            Register
          </Link>
        </p>
        <p>
          <Link
            href="/forgot-password"
            className="text-surface-400 hover:text-surface-300"
          >
            Forgot your password?
          </Link>
        </p>
      </div>
    </>
  );
}
