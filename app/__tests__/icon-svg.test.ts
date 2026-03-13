import { describe, it, expect, beforeAll } from "vitest";
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

  describe("SVG structure integrity", () => {
    it("starts with <svg or a valid XML declaration", () => {
      const trimmed = svgContent.trimStart();
      const startsWithSvg = trimmed.startsWith("<svg");
      const startsWithXmlDecl = trimmed.startsWith("<?xml");
      expect(startsWithSvg || startsWithXmlDecl).toBe(true);
    });

    it("has no duplicate attributes on the <svg> element", () => {
      const svgTagMatch = svgContent.match(/<svg\b([^>]*)>/);
      expect(svgTagMatch).not.toBeNull();
      const attrs = svgTagMatch![1];
      const attrNames = [...attrs.matchAll(/\b([\w-]+)\s*=/g)].map((m) => m[1]);
      const uniqueNames = new Set(attrNames);
      expect(attrNames.length).toBe(uniqueNames.size);
    });

    it("has exactly 2 child elements (one rect + one text)", () => {
      // Extract content between <svg ...> and </svg>
      const innerMatch = svgContent.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
      expect(innerMatch).not.toBeNull();
      const inner = innerMatch![1];
      // Match opening tags that are not closing tags and not self-closing markers
      const openingTags = inner.match(/<(?!\/)(\w+)\b/g);
      expect(openingTags).not.toBeNull();
      expect(openingTags!.length).toBe(2);
    });

    it("total file size is under 1KB", () => {
      const sizeInBytes = Buffer.byteLength(svgContent, "utf-8");
      expect(sizeInBytes).toBeLessThan(1024);
    });
  });

  describe("rect positioning", () => {
    it('rect has x="0" or no x attribute (defaults to 0)', () => {
      const rectMatch = svgContent.match(/<rect\b([^>]*)>/);
      expect(rectMatch).not.toBeNull();
      const rectAttrs = rectMatch![1];
      const hasExplicitX = /\bx="([^"]*)"/.exec(rectAttrs);
      if (hasExplicitX) {
        expect(hasExplicitX[1]).toBe("0");
      }
      // If no x attribute, that's also valid (defaults to 0)
      expect(true).toBe(true);
    });

    it('rect has y="0" or no y attribute (defaults to 0)', () => {
      const rectMatch = svgContent.match(/<rect\b([^>]*)>/);
      expect(rectMatch).not.toBeNull();
      const rectAttrs = rectMatch![1];
      const hasExplicitY = /\by="([^"]*)"/.exec(rectAttrs);
      if (hasExplicitY) {
        expect(hasExplicitY[1]).toBe("0");
      }
      // If no y attribute, that's also valid (defaults to 0)
      expect(true).toBe(true);
    });
  });

  describe("text content edge cases", () => {
    it('text content is exactly "WW" with no extra whitespace', () => {
      const textContentMatch = svgContent.match(/<text[^>]*>(.*?)<\/text>/);
      expect(textContentMatch).not.toBeNull();
      expect(textContentMatch![1]).toBe("WW");
    });

    it("no other text elements exist in the SVG (exactly one text node)", () => {
      const textTags = svgContent.match(/<text\b/g);
      expect(textTags).toHaveLength(1);
      const closingTextTags = svgContent.match(/<\/text>/g);
      expect(closingTextTags).toHaveLength(1);
    });
  });

  describe("color format consistency", () => {
    it("rect fill uses lowercase hex format", () => {
      const rectMatch = svgContent.match(/<rect[^>]*\bfill="([^"]*)"/);
      expect(rectMatch).not.toBeNull();
      const fillValue = rectMatch![1];
      // Must be lowercase hex: # followed by lowercase hex digits
      expect(fillValue).toMatch(/^#[0-9a-f]{3,8}$/);
    });

    it('text fill uses a named color or valid hex ("white" or "#ffffff" or "#fff")', () => {
      const textMatch = svgContent.match(/<text[^>]*\bfill="([^"]*)"/);
      expect(textMatch).not.toBeNull();
      const fillValue = textMatch![1];
      const isNamedColor = fillValue === "white";
      const isHex = /^#[0-9a-fA-F]{3,8}$/.test(fillValue);
      expect(isNamedColor || isHex).toBe(true);
    });
  });

  describe("accessibility", () => {
    it('SVG does not have aria-hidden="true" (should be visible as favicon)', () => {
      expect(svgContent).not.toMatch(/<svg[^>]*\baria-hidden="true"/);
    });
  });

  describe("no embedded styles", () => {
    it("does not contain <style> tags", () => {
      expect(svgContent).not.toMatch(/<style\b/i);
    });

    it("does not contain <defs> elements", () => {
      expect(svgContent).not.toMatch(/<defs\b/i);
    });

    it("does not contain CSS class attributes", () => {
      expect(svgContent).not.toMatch(/\bclass="/);
    });
  });

  describe("closing tag well-formedness", () => {
    it("opening tags match closing patterns (well-formed XML)", () => {
      // Count all element occurrences: opening+closing pairs and self-closing
      const closingTags = svgContent.match(/<\/(\w+)>/g) || [];
      const selfClosingTags = svgContent.match(/<\w+\b[^>]*\/>/g) || [];
      // Total distinct elements = closing tags (each has a matching open) + self-closing
      const totalElements = closingTags.length + selfClosingTags.length;
      // We expect 3 elements: svg (open+close), text (open+close), rect (self-closing)
      expect(totalElements).toBeGreaterThanOrEqual(2);
      // Every closing tag name should also appear as an opening tag
      for (const tag of closingTags) {
        const tagName = tag.match(/<\/(\w+)>/)?.[1];
        expect(svgContent).toContain(`<${tagName}`);
      }
    });

    it("self-closing tags are properly formed", () => {
      const selfClosing = svgContent.match(/<\w+\b[^>]*\/>/g) || [];
      for (const tag of selfClosing) {
        // Each self-closing tag should end with />
        expect(tag).toMatch(/\/>$/);
        // Should have a valid tag name
        expect(tag).toMatch(/^<\w+/);
      }
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
