import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const routeGroups = ["(auth)", "(member)", "(owner)", "(trainer)"] as const;

describe("Loading states across route groups", () => {
  // ----- Every route group has a loading.tsx -----

  describe("loading.tsx existence", () => {
    for (const group of routeGroups) {
      it(`${group} route group has a loading.tsx file`, () => {
        const loadingPath = path.resolve(
          process.cwd(),
          `app/${group}/loading.tsx`
        );
        expect(fs.existsSync(loadingPath)).toBe(true);
      });
    }
  });

  // ----- All loading components are identical -----

  describe("loading component consistency", () => {
    it("all route groups use identical loading component code", () => {
      const contents = routeGroups.map((group) =>
        fs
          .readFileSync(
            path.resolve(process.cwd(), `app/${group}/loading.tsx`),
            "utf-8"
          )
          .replace(/\r\n/g, "\n")
      );

      // All should be identical (normalized line endings)
      for (let i = 1; i < contents.length; i++) {
        expect(contents[i]).toBe(contents[0]);
      }
    });
  });

  // ----- Loading component structure -----

  describe("loading component structure", () => {
    const loadingContent = fs.readFileSync(
      path.resolve(process.cwd(), "app/(auth)/loading.tsx"),
      "utf-8"
    );

    it("exports a default function named Loading", () => {
      expect(loadingContent).toMatch(
        /export default function Loading\(\)/
      );
    });

    it("has explicit React.ReactElement return type", () => {
      expect(loadingContent).toContain("React.ReactElement");
    });

    it("is a Server Component (no 'use client')", () => {
      expect(loadingContent).not.toContain('"use client"');
    });

    it("uses animate-spin for spinner animation", () => {
      expect(loadingContent).toContain("animate-spin");
    });

    it("uses brand color border-primary-400", () => {
      expect(loadingContent).toContain("border-primary-400");
    });

    it("uses transparent top border for spinning effect", () => {
      expect(loadingContent).toContain("border-t-transparent");
    });

    it("uses h-64 container for vertical centering space", () => {
      expect(loadingContent).toContain("h-64");
    });

    it("uses flex centering (items-center, justify-center)", () => {
      expect(loadingContent).toContain("items-center");
      expect(loadingContent).toContain("justify-center");
    });

    it("uses h-8 w-8 for spinner size", () => {
      expect(loadingContent).toContain("h-8");
      expect(loadingContent).toContain("w-8");
    });

    it("uses border-2 for spinner thickness", () => {
      expect(loadingContent).toContain("border-2");
    });

    it("uses rounded-full for circular shape", () => {
      expect(loadingContent).toContain("rounded-full");
    });
  });
});
