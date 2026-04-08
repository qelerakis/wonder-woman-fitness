import { describe, it, expect } from "vitest";

describe("Auth Layout lazy loading", () => {
  it("uses LazyAuthBackground wrapper instead of direct AuthBackground import", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const layoutContent = fs.readFileSync(
      path.resolve(process.cwd(), "app/(auth)/layout.tsx"),
      "utf-8"
    );

    // Verify LazyAuthBackground is imported
    expect(layoutContent).toContain("LazyAuthBackground");
    // Verify the static AuthBackground import is NOT used
    expect(layoutContent).not.toMatch(
      /import\s*\{[^}]*AuthBackground[^}]*\}\s*from\s*["']@\/components\/layout\/AuthBackground["']/
    );
  });

  it("LazyAuthBackground client wrapper uses dynamic with ssr: false", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const wrapperContent = fs.readFileSync(
      path.resolve(process.cwd(), "components/layout/LazyAuthBackground.tsx"),
      "utf-8"
    );

    // Must be a client component
    expect(wrapperContent).toContain('"use client"');
    // Must use next/dynamic
    expect(wrapperContent).toContain("next/dynamic");
    // Must disable SSR
    expect(wrapperContent).toContain("ssr: false");
    // Must import AuthBackground
    expect(wrapperContent).toContain("AuthBackground");
  });
});
