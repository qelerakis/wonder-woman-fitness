import { describe, it, expect } from "vitest";

describe("Auth Layout lazy loading", () => {
  it("uses dynamic import for AuthBackground with ssr: false", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const layoutContent = fs.readFileSync(
      path.resolve(process.cwd(), "app/(auth)/layout.tsx"),
      "utf-8"
    );

    // Verify dynamic import is used
    expect(layoutContent).toContain('import dynamic from "next/dynamic"');
    // Verify ssr is disabled
    expect(layoutContent).toContain("ssr: false");
    // Verify AuthBackground is loaded dynamically
    expect(layoutContent).toContain("AuthBackground");
    // Verify the static import is NOT used
    expect(layoutContent).not.toMatch(
      /import\s*\{[^}]*AuthBackground[^}]*\}\s*from\s*["']@\/components\/layout\/AuthBackground["']/
    );
  });
});
