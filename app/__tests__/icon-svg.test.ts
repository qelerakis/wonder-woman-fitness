import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const SVG_PATH = path.join(__dirname, "..", "icon.svg");

describe("app/icon.svg favicon", () => {
  let svgContent: string;

  beforeAll(() => {
    svgContent = fs.readFileSync(SVG_PATH, "utf-8");
  });

  describe("file existence and validity", () => {
    it("exists and can be read from app/icon.svg", () => {
      expect(() => fs.readFileSync(SVG_PATH, "utf-8")).not.toThrow();
    });

    it("is a valid SVG with opening <svg tag", () => {
      expect(svgContent).toContain("<svg");
    });

    it("has proper SVG xmlns namespace", () => {
      expect(svgContent).toContain('xmlns="http://www.w3.org/2000/svg"');
    });

    it("has a closing </svg> tag", () => {
      expect(svgContent).toContain("</svg>");
    });
  });

  describe("dimensions", () => {
    it('has width="32"', () => {
      expect(svgContent).toMatch(/<svg[^>]*\bwidth="32"/);
    });

    it('has height="32"', () => {
      expect(svgContent).toMatch(/<svg[^>]*\bheight="32"/);
    });

    it('has viewBox="0 0 32 32"', () => {
      expect(svgContent).toMatch(/<svg[^>]*\bviewBox="0 0 32 32"/);
    });
  });

  describe("background rect", () => {
    it("contains a <rect> element", () => {
      expect(svgContent).toMatch(/<rect\b/);
    });

    it("has exactly one rect element", () => {
      const matches = svgContent.match(/<rect\b/g);
      expect(matches).toHaveLength(1);
    });

    it('rect has width="32"', () => {
      expect(svgContent).toMatch(/<rect[^>]*\bwidth="32"/);
    });

    it('rect has height="32"', () => {
      expect(svgContent).toMatch(/<rect[^>]*\bheight="32"/);
    });

    it('rect has rx="6" for rounded corners', () => {
      expect(svgContent).toMatch(/<rect[^>]*\brx="6"/);
    });

    it('rect fill is brand color "#9333ea" (primary-600)', () => {
      expect(svgContent).toMatch(/<rect[^>]*\bfill="#9333ea"/);
    });
  });

  describe("text element", () => {
    it("contains a <text> element", () => {
      expect(svgContent).toMatch(/<text\b/);
    });

    it("has exactly one text element", () => {
      const matches = svgContent.match(/<text\b/g);
      expect(matches).toHaveLength(1);
    });

    it('contains "WW" text content', () => {
      expect(svgContent).toMatch(/<text[^>]*>WW<\/text>/);
    });
  });

  describe("text positioning", () => {
    it('text x="16" for horizontal centering', () => {
      expect(svgContent).toMatch(/<text[^>]*\bx="16"/);
    });

    it('text y="22" for vertical positioning', () => {
      expect(svgContent).toMatch(/<text[^>]*\by="22"/);
    });

    it('text-anchor="middle" for center alignment', () => {
      expect(svgContent).toMatch(/<text[^>]*\btext-anchor="middle"/);
    });
  });

  describe("text styling", () => {
    it('text fill is "white"', () => {
      expect(svgContent).toMatch(/<text[^>]*\bfill="white"/);
    });

    it('font-weight is "bold"', () => {
      expect(svgContent).toMatch(/<text[^>]*\bfont-weight="bold"/);
    });

    it('font-family includes "Arial"', () => {
      expect(svgContent).toMatch(/<text[^>]*\bfont-family="[^"]*Arial[^"]*"/);
    });

    it('font-family includes fallback "Helvetica"', () => {
      expect(svgContent).toMatch(/<text[^>]*\bfont-family="[^"]*Helvetica[^"]*"/);
    });

    it('font-family includes generic "sans-serif" fallback', () => {
      expect(svgContent).toMatch(/<text[^>]*\bfont-family="[^"]*sans-serif[^"]*"/);
    });

    it('font-size is "14"', () => {
      expect(svgContent).toMatch(/<text[^>]*\bfont-size="14"/);
    });
  });

  describe("security and external references", () => {
    it("does not contain xlink:href", () => {
      expect(svgContent).not.toContain("xlink:href");
    });

    it("does not contain external http URLs", () => {
      // xmlns URL is allowed, but no other http references
      const withoutXmlns = svgContent.replace(
        /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g,
        ""
      );
      expect(withoutXmlns).not.toMatch(/https?:\/\//);
    });

    it("does not contain <script> tags", () => {
      expect(svgContent).not.toMatch(/<script\b/i);
    });

    it("does not contain <foreignObject> elements", () => {
      expect(svgContent).not.toMatch(/<foreignObject\b/i);
    });

    it("does not contain event handler attributes", () => {
      expect(svgContent).not.toMatch(/\bon\w+\s*=/i);
    });
  });
});
