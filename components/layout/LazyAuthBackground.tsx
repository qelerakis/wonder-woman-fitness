"use client";

import dynamic from "next/dynamic";

const AuthBackground = dynamic(
  () =>
    import("@/components/layout/AuthBackground").then((m) => ({
      default: m.AuthBackground,
    })),
  { ssr: false }
);

export function LazyAuthBackground(): React.ReactElement | null {
  return <AuthBackground />;
}
