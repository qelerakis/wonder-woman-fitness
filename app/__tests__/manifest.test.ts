import { describe, it, expect } from "vitest";
import manifest from "../manifest";

describe("manifest", () => {
  describe("return type", () => {
    it("returns an object", () => {
      const result = manifest();
      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
      expect(result).not.toBeNull();
    });
  });

  describe("app identity", () => {
    it("has the correct app name", () => {
      const result = manifest();
      expect(result.name).toBe("Wonder Woman Fitness");
    });

    it("has the correct short name", () => {
      const result = manifest();
      expect(result.short_name).toBe("WW Fitness");
    });

    it("has a description matching the site purpose", () => {
      const result = manifest();
      expect(result.description).toBe(
        "Studio management platform for Wonder Woman Fitness"
      );
    });
  });

  describe("PWA configuration", () => {
    it("sets start_url to root path", () => {
      const result = manifest();
      expect(result.start_url).toBe("/");
    });

    it("sets display to standalone", () => {
      const result = manifest();
      expect(result.display).toBe("standalone");
    });
  });

  describe("brand colors", () => {
    it("sets background_color to surface-950 (#020617)", () => {
      const result = manifest();
      expect(result.background_color).toBe("#020617");
    });

    it("sets theme_color to primary-600 (#9333ea)", () => {
      const result = manifest();
      expect(result.theme_color).toBe("#9333ea");
    });

    it("uses valid hex color format for background_color", () => {
      const result = manifest();
      expect(result.background_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it("uses valid hex color format for theme_color", () => {
      const result = manifest();
      expect(result.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  describe("icons array", () => {
    it("contains exactly 2 icons", () => {
      const result = manifest();
      expect(result.icons).toHaveLength(2);
    });

    it("all icon paths are absolute (start with /)", () => {
      const result = manifest();
      for (const icon of result.icons!) {
        expect(icon.src).toMatch(/^\//);
      }
    });

    it("all icons have type image/png", () => {
      const result = manifest();
      for (const icon of result.icons!) {
        expect(icon.type).toBe("image/png");
      }
    });
  });

  describe("192x192 icon", () => {
    it("has correct src", () => {
      const result = manifest();
      const icon = result.icons![0];
      expect(icon.src).toBe("/icon-192.png");
    });

    it("has correct sizes", () => {
      const result = manifest();
      const icon = result.icons![0];
      expect(icon.sizes).toBe("192x192");
    });

    it("has correct type", () => {
      const result = manifest();
      const icon = result.icons![0];
      expect(icon.type).toBe("image/png");
    });

    it("does not have a purpose field", () => {
      const result = manifest();
      const icon = result.icons![0];
      expect(icon).not.toHaveProperty("purpose");
    });
  });

  describe("512x512 icon", () => {
    it("has correct src", () => {
      const result = manifest();
      const icon = result.icons![1];
      expect(icon.src).toBe("/icon-512.png");
    });

    it("has correct sizes", () => {
      const result = manifest();
      const icon = result.icons![1];
      expect(icon.sizes).toBe("512x512");
    });

    it("has correct type", () => {
      const result = manifest();
      const icon = result.icons![1];
      expect(icon.type).toBe("image/png");
    });

    it("has purpose set to 'maskable'", () => {
      const result = manifest();
      const icon = result.icons![1];
      expect(icon.purpose).toBe("maskable");
    });
  });

  describe("no extra fields", () => {
    it("contains only expected top-level properties", () => {
      const result = manifest();
      const keys = Object.keys(result).sort();
      const expectedKeys = [
        "background_color",
        "description",
        "display",
        "icons",
        "name",
        "short_name",
        "start_url",
        "theme_color",
      ].sort();
      expect(keys).toEqual(expectedKeys);
    });

    it("192x192 icon has only expected properties", () => {
      const result = manifest();
      const keys = Object.keys(result.icons![0]).sort();
      expect(keys).toEqual(["sizes", "src", "type"]);
    });

    it("512x512 icon has only expected properties", () => {
      const result = manifest();
      const keys = Object.keys(result.icons![1]).sort();
      expect(keys).toEqual(["purpose", "sizes", "src", "type"]);
    });
  });

  describe("idempotency", () => {
    it("returns the same result on multiple calls", () => {
      const first = manifest();
      const second = manifest();
      const third = manifest();
      expect(first).toEqual(second);
      expect(second).toEqual(third);
    });

    it("returns a new object reference each time", () => {
      const first = manifest();
      const second = manifest();
      expect(first).not.toBe(second);
    });
  });
});
