import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const configPath = path.resolve(process.cwd(), "next.config.ts");
const configContent = fs.readFileSync(configPath, "utf-8");

describe("next.config.ts", () => {
  // ----- optimizePackageImports -----

  describe("optimizePackageImports", () => {
    it("enables the experimental optimizePackageImports setting", () => {
      expect(configContent).toContain("optimizePackageImports");
    });

    it("optimizes date-fns (used in 20+ files, large barrel exports)", () => {
      expect(configContent).toContain("date-fns");
    });

    it("optimizes recharts (large chart library)", () => {
      expect(configContent).toContain("recharts");
    });

    it("optimizes next-intl (i18n library)", () => {
      expect(configContent).toContain("next-intl");
    });

    it("places optimizePackageImports under experimental key", () => {
      // Verify the structure: experimental { optimizePackageImports: [...] }
      expect(configContent).toMatch(
        /experimental:\s*\{[^}]*optimizePackageImports/
      );
    });
  });

  // ----- serverExternalPackages (unchanged) -----

  describe("serverExternalPackages", () => {
    it("keeps @prisma/client as server-only", () => {
      expect(configContent).toContain("@prisma/client");
    });

    it("keeps @prisma/adapter-pg as server-only", () => {
      expect(configContent).toContain("@prisma/adapter-pg");
    });

    it("keeps bcrypt as server-only", () => {
      expect(configContent).toContain("bcrypt");
    });
  });

  // ----- Security headers -----

  describe("security headers", () => {
    it("includes X-Frame-Options: DENY", () => {
      expect(configContent).toContain("X-Frame-Options");
      expect(configContent).toContain("DENY");
    });

    it("includes Content-Security-Policy", () => {
      expect(configContent).toContain("Content-Security-Policy");
    });

    it("includes Strict-Transport-Security with preload", () => {
      expect(configContent).toContain("Strict-Transport-Security");
      expect(configContent).toContain("preload");
    });
  });

  // ----- i18n plugin -----

  describe("i18n plugin", () => {
    it("uses next-intl plugin", () => {
      expect(configContent).toContain("next-intl/plugin");
    });

    it("points to correct i18n request config", () => {
      expect(configContent).toContain("./i18n/request.ts");
    });

    it("wraps config with withNextIntl", () => {
      expect(configContent).toContain("withNextIntl(nextConfig)");
    });
  });
});
