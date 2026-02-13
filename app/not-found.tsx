import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFoundPage(): React.ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950 px-4">
      <div className="max-w-md text-center">
        {/* 404 display */}
        <p className="mb-2 text-7xl font-bold text-primary-500">404</p>

        <h1 className="mb-2 text-2xl font-bold text-surface-100">
          Page not found
        </h1>
        <p className="mb-6 text-surface-400">
          The page you&apos;re looking for doesn&apos;t exist or has been
          moved.
        </p>

        <Link href="/">
          <Button variant="primary">Go Home</Button>
        </Link>
      </div>
    </div>
  );
}
