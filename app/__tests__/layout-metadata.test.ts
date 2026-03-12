import { describe, it, expect, vi, beforeAll } from "vitest";
import type { Metadata } from "next";

// Mock all dependencies so the module can be imported without side effects
vi.mock("next-intl/server", () => ({
  getLocale: vi.fn(() => Promise.resolve("en")),
  getMessages: vi.fn(() => Promise.resolve({})),
}));
vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/ui/Toast", () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@vercel/analytics/next", () => ({
  Analytics: () => null,
}));
vi.mock("@vercel/speed-insights/next", () => ({
  SpeedInsights: () => null,
}));
vi.mock("next-intl", () => ({
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

describe("RootLayout metadata", () => {
  let metadata: Metadata;

  beforeAll(async () => {
    const layoutModule = await import("@/app/layout");
    metadata = layoutModule.metadata;
  });

  it("exports a metadata object", () => {
    expect(metadata).toBeDefined();
    expect(typeof metadata).toBe("object");
  });

  describe("title", () => {
    it('has title set to "Wonder Woman Fitness"', () => {
      expect(metadata.title).toBe("Wonder Woman Fitness");
    });
  });

  describe("description", () => {
    it("has the correct description", () => {
      expect(metadata.description).toBe(
        "Studio management platform for Wonder Woman Fitness"
      );
    });
  });

  describe("openGraph", () => {
    it("has openGraph configured", () => {
      expect(metadata.openGraph).toBeDefined();
    });

    it('has openGraph title set to "Wonder Woman Fitness"', () => {
      expect(
        metadata.openGraph && "title" in metadata.openGraph
          ? metadata.openGraph.title
          : undefined
      ).toBe("Wonder Woman Fitness");
    });

    it("has correct openGraph description", () => {
      expect(
        metadata.openGraph && "description" in metadata.openGraph
          ? metadata.openGraph.description
          : undefined
      ).toBe("Studio management platform for Wonder Woman Fitness");
    });

    it('has openGraph type set to "website"', () => {
      expect(
        metadata.openGraph && "type" in metadata.openGraph
          ? metadata.openGraph.type
          : undefined
      ).toBe("website");
    });
  });

  describe("theme colors", () => {
    it('has theme-color set to "#9333ea" in other', () => {
      expect(metadata.other).toBeDefined();
      const other = metadata.other as Record<string, string>;
      expect(other["theme-color"]).toBe("#9333ea");
    });

    it('has msapplication-TileColor set to "#9333ea" in other', () => {
      const other = metadata.other as Record<string, string>;
      expect(other["msapplication-TileColor"]).toBe("#9333ea");
    });

    it("theme-color and msapplication-TileColor match each other (brand primary-600 purple)", () => {
      const other = metadata.other as Record<string, string>;
      expect(other["theme-color"]).toBe(other["msapplication-TileColor"]);
    });
  });

  describe("no deprecated themeColor field", () => {
    it("does not have a top-level themeColor property", () => {
      expect(
        "themeColor" in metadata && metadata.themeColor !== undefined
      ).toBe(false);
    });
  });

  describe("consistency checks", () => {
    it("openGraph title matches metadata title", () => {
      const ogTitle =
        metadata.openGraph && "title" in metadata.openGraph
          ? metadata.openGraph.title
          : undefined;
      expect(ogTitle).toBe(metadata.title);
    });

    it("openGraph description matches metadata description", () => {
      const ogDescription =
        metadata.openGraph && "description" in metadata.openGraph
          ? metadata.openGraph.description
          : undefined;
      expect(ogDescription).toBe(metadata.description);
    });
  });
});
