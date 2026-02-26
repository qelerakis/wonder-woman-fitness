import { getTranslations } from "next-intl/server";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tBrand = await getTranslations("brand");

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-950 px-4">
      <div className="w-full max-w-md">
        {/* Brand Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-primary-400">
            {tBrand("name")}
          </h1>
          <p className="mt-2 text-sm text-surface-400">
            {tBrand("tagline")}
          </p>
        </div>

        {/* Auth Card */}
        <div className="rounded-xl border border-surface-700 bg-surface-900 p-8 shadow-lg">
          {children}
        </div>
      </div>
    </div>
  );
}
