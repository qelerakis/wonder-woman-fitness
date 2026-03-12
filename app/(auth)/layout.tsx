import { getTranslations } from "next-intl/server";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { AuthBackground } from "@/components/layout/AuthBackground";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tBrand = await getTranslations("brand");

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-surface-950 px-4">
      {/* Animated Background */}
      <AuthBackground />

      {/* Language Toggle */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageToggle />
      </div>

      <div className="relative z-10 w-full max-w-md pt-14 sm:pt-0">
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
