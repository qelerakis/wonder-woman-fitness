import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "fs";
import { resolve } from "path";
import sharp from "sharp";

const ROOT = resolve(__dirname, "../..");

const APPLE_ICON = resolve(ROOT, "app/apple-icon.png");
const ICON_192 = resolve(ROOT, "public/icon-192.png");
const ICON_512 = resolve(ROOT, "public/icon-512.png");
const GENERATE_SCRIPT = resolve(ROOT, "scripts/generate-icons.mjs");

describe("Generated PNG Icons", () => {
  // ── PNG File Existence ──────────────────────────────────────────────

  describe("apple-icon.png", () => {
    it("exists and is readable", () => {
      expect(() => readFileSync(APPLE_ICON)).not.toThrow();
    });

    it("has dimensions 180x180", async () => {
      const metadata = await sharp(APPLE_ICON).metadata();
      expect(metadata.width).toBe(180);
      expect(metadata.height).toBe(180);
    });

    it("is PNG format", async () => {
      const metadata = await sharp(APPLE_ICON).metadata();
      expect(metadata.format).toBe("png");
    });

    it("is located in app/ directory for Next.js auto-detection", () => {
      expect(APPLE_ICON).toContain(resolve(ROOT, "app"));
      expect(() => statSync(APPLE_ICON)).not.toThrow();
    });
  });

  describe("icon-192.png", () => {
    it("exists and is readable", () => {
      expect(() => readFileSync(ICON_192)).not.toThrow();
    });

    it("has dimensions 192x192", async () => {
      const metadata = await sharp(ICON_192).metadata();
      expect(metadata.width).toBe(192);
      expect(metadata.height).toBe(192);
    });

    it("is PNG format", async () => {
      const metadata = await sharp(ICON_192).metadata();
      expect(metadata.format).toBe("png");
    });

    it("is located in public/ directory for static serving", () => {
      expect(ICON_192).toContain(resolve(ROOT, "public"));
      expect(() => statSync(ICON_192)).not.toThrow();
    });
  });

  describe("icon-512.png", () => {
    it("exists and is readable", () => {
      expect(() => readFileSync(ICON_512)).not.toThrow();
    });

    it("has dimensions 512x512", async () => {
      const metadata = await sharp(ICON_512).metadata();
      expect(metadata.width).toBe(512);
      expect(metadata.height).toBe(512);
    });

    it("is PNG format", async () => {
      const metadata = await sharp(ICON_512).metadata();
      expect(metadata.format).toBe("png");
    });

    it("is located in public/ directory for static serving", () => {
      expect(ICON_512).toContain(resolve(ROOT, "public"));
      expect(() => statSync(ICON_512)).not.toThrow();
    });
  });

  // ── File Size Verification ──────────────────────────────────────────

  describe("file sizes are reasonable", () => {
    it("apple-icon.png is not empty and under 100KB", () => {
      const stat = statSync(APPLE_ICON);
      expect(stat.size).toBeGreaterThan(0);
      expect(stat.size).toBeLessThan(100 * 1024);
    });

    it("icon-192.png is not empty and under 100KB", () => {
      const stat = statSync(ICON_192);
      expect(stat.size).toBeGreaterThan(0);
      expect(stat.size).toBeLessThan(100 * 1024);
    });

    it("icon-512.png is not empty and under 200KB", () => {
      const stat = statSync(ICON_512);
      expect(stat.size).toBeGreaterThan(0);
      expect(stat.size).toBeLessThan(200 * 1024);
    });
  });

  // ── PNG Content Verification ────────────────────────────────────────

  describe("PNG content properties", () => {
    it("apple-icon.png has alpha channel (RGBA, 4 channels)", async () => {
      const metadata = await sharp(APPLE_ICON).metadata();
      expect(metadata.channels).toBe(4);
    });

    it("icon-192.png has alpha channel (RGBA, 4 channels)", async () => {
      const metadata = await sharp(ICON_192).metadata();
      expect(metadata.channels).toBe(4);
    });

    it("icon-512.png has alpha channel (RGBA, 4 channels)", async () => {
      const metadata = await sharp(ICON_512).metadata();
      expect(metadata.channels).toBe(4);
    });

    it("apple-icon.png uses sRGB color space", async () => {
      const metadata = await sharp(APPLE_ICON).metadata();
      expect(metadata.space).toBe("srgb");
    });

    it("icon-192.png uses sRGB color space", async () => {
      const metadata = await sharp(ICON_192).metadata();
      expect(metadata.space).toBe("srgb");
    });

    it("icon-512.png uses sRGB color space", async () => {
      const metadata = await sharp(ICON_512).metadata();
      expect(metadata.space).toBe("srgb");
    });
  });

  // ── Generation Script Verification ──────────────────────────────────

  describe("generate-icons.mjs script", () => {
    const scriptContent = readFileSync(GENERATE_SCRIPT, "utf-8");

    it("exists and is readable", () => {
      expect(scriptContent.length).toBeGreaterThan(0);
    });

    it("imports sharp", () => {
      expect(scriptContent).toContain('import sharp from "sharp"');
    });

    it("references correct brand color #9333ea", () => {
      expect(scriptContent).toContain("#9333ea");
    });

    it('references correct text "WW"', () => {
      expect(scriptContent).toContain(">WW<");
    });

    it("generates apple-icon at size 180", () => {
      expect(scriptContent).toContain("180");
      expect(scriptContent).toContain("app/apple-icon.png");
    });

    it("generates PWA icon at size 192", () => {
      expect(scriptContent).toContain("192");
      expect(scriptContent).toContain("public/icon-192.png");
    });

    it("generates PWA icon at size 512", () => {
      expect(scriptContent).toContain("512");
      expect(scriptContent).toContain("public/icon-512.png");
    });

    it('creates app directory with mkdir', () => {
      expect(scriptContent).toMatch(/mkdir\(["']app["']/);
    });

    it('creates public directory with mkdir', () => {
      expect(scriptContent).toMatch(/mkdir\(["']public["']/);
    });
  });
});
