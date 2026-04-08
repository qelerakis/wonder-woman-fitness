import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const layoutPath = path.resolve(process.cwd(), "app/(auth)/layout.tsx");
const wrapperPath = path.resolve(
  process.cwd(),
  "components/layout/LazyAuthBackground.tsx"
);
const originalBgPath = path.resolve(
  process.cwd(),
  "components/layout/AuthBackground.tsx"
);

const layoutContent = fs.readFileSync(layoutPath, "utf-8");
const wrapperContent = fs.readFileSync(wrapperPath, "utf-8");
const originalBgContent = fs.readFileSync(originalBgPath, "utf-8");

describe("Auth Layout lazy loading", () => {
  // ----- Layout imports the wrapper, not the original -----

  describe("Auth layout import strategy", () => {
    it("imports LazyAuthBackground from the wrapper module", () => {
      expect(layoutContent).toContain("LazyAuthBackground");
      expect(layoutContent).toContain(
        '@/components/layout/LazyAuthBackground'
      );
    });

    it("does NOT import AuthBackground directly from the original module", () => {
      expect(layoutContent).not.toMatch(
        /import\s*\{[^}]*AuthBackground[^}]*\}\s*from\s*["']@\/components\/layout\/AuthBackground["']/
      );
    });

    it("uses <LazyAuthBackground /> in JSX", () => {
      expect(layoutContent).toContain("<LazyAuthBackground");
    });

    it("does NOT use <AuthBackground /> in JSX", () => {
      expect(layoutContent).not.toMatch(/<AuthBackground\s*\/>/);
    });

    it("does NOT import next/dynamic directly (delegated to wrapper)", () => {
      expect(layoutContent).not.toContain('from "next/dynamic"');
    });

    it("remains an async Server Component (no 'use client')", () => {
      expect(layoutContent).not.toContain('"use client"');
      expect(layoutContent).toContain("async function AuthLayout");
    });
  });

  // ----- LazyAuthBackground client wrapper -----

  describe("LazyAuthBackground wrapper", () => {
    it("is a client component ('use client' directive)", () => {
      expect(wrapperContent).toMatch(/^"use client"/);
    });

    it("imports dynamic from next/dynamic", () => {
      expect(wrapperContent).toContain('import dynamic from "next/dynamic"');
    });

    it("disables SSR with { ssr: false }", () => {
      expect(wrapperContent).toContain("ssr: false");
    });

    it("dynamically imports the original AuthBackground component", () => {
      expect(wrapperContent).toContain(
        'import("@/components/layout/AuthBackground")'
      );
    });

    it("maps the named export to default for dynamic()", () => {
      // next/dynamic requires a default export; AuthBackground is a named export
      expect(wrapperContent).toContain("default: m.AuthBackground");
    });

    it("exports a named function LazyAuthBackground", () => {
      expect(wrapperContent).toMatch(
        /export function LazyAuthBackground\(\)/
      );
    });

    it("has correct return type annotation (ReactElement, not null)", () => {
      expect(wrapperContent).toContain("React.ReactElement {");
      expect(wrapperContent).not.toContain("ReactElement | null");
    });

    it("renders AuthBackground in JSX", () => {
      expect(wrapperContent).toContain("<AuthBackground />");
    });
  });

  // ----- Original AuthBackground component -----

  describe("Original AuthBackground component", () => {
    it("is a client component", () => {
      expect(originalBgContent).toContain('"use client"');
    });

    it("is a named export (not default)", () => {
      expect(originalBgContent).toMatch(/export function AuthBackground/);
      expect(originalBgContent).not.toContain("export default");
    });

    it("is decorative (aria-hidden)", () => {
      expect(originalBgContent).toContain('aria-hidden="true"');
    });

    it("is non-interactive (pointer-events-none)", () => {
      expect(originalBgContent).toContain("pointer-events-none");
    });

    it("contains GPU-intensive blur animations", () => {
      expect(originalBgContent).toContain("blur-[60px]");
      expect(originalBgContent).toContain("blur-[50px]");
    });

    it("has three animated orb elements", () => {
      const orbCount = (originalBgContent.match(/auth-orb/g) || []).length;
      expect(orbCount).toBe(3);
    });
  });
});
