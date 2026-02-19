import Link from "next/link";
import { verifyEmailToken } from "./actions";

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="text-center">
        <h2 className="mb-4 text-xl font-semibold text-error-400">
          Invalid Link
        </h2>
        <p className="mb-6 text-surface-400">
          No verification token provided.
        </p>
        <Link
          href="/register"
          className="text-primary-400 hover:text-primary-300"
        >
          Back to Register
        </Link>
      </div>
    );
  }

  const result = await verifyEmailToken(token);

  if (!result.success) {
    return (
      <div className="text-center">
        <h2 className="mb-4 text-xl font-semibold text-error-400">
          Verification Failed
        </h2>
        <p className="mb-6 text-surface-400">
          {result.error}
        </p>
        <Link
          href="/register"
          className="text-primary-400 hover:text-primary-300"
        >
          Register Again
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h2 className="mb-4 text-xl font-semibold text-success-400">
        Email Verified!
      </h2>
      <p className="mb-6 text-surface-400">
        Your account has been created successfully. You can now sign in.
      </p>
      <Link
        href="/login"
        className="inline-block rounded-lg bg-primary-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-primary-700"
      >
        Sign In
      </Link>
    </div>
  );
}
