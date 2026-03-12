import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/ui/Toast";
import { Footer } from "@/components/layout/Footer";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wonder Woman Fitness",
  description: "Studio management platform for Wonder Woman Fitness",
  openGraph: {
    title: "Wonder Woman Fitness",
    description: "Studio management platform for Wonder Woman Fitness",
    type: "website",
  },
  other: {
    "theme-color": "#9333ea",
    "msapplication-TileColor": "#9333ea",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): Promise<React.ReactElement> {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col bg-surface-950 text-surface-200 antialiased">
        <NextIntlClientProvider messages={messages}>
          <SessionProvider>
            <ToastProvider>
              <div className="flex-1">{children}</div>
              <Footer />
            </ToastProvider>
          </SessionProvider>
        </NextIntlClientProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
