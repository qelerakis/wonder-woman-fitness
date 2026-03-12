import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "../Footer";
import en from "../../../messages/en.json";
import mk from "../../../messages/mk.json";

describe("Footer", () => {
  describe("rendering", () => {
    it("renders the credit text inside a semantic footer element", () => {
      render(<Footer />);
      const footer = screen.getByRole("contentinfo");
      expect(footer).toBeTruthy();
      expect(footer.tagName).toBe("FOOTER");
      expect(footer.textContent).toBe("Made by Stefan Savevski");
    });

    it("renders exactly one footer element", () => {
      const { container } = render(<Footer />);
      const footers = container.querySelectorAll("footer");
      expect(footers.length).toBe(1);
    });

    it("renders only plain text with no child elements", () => {
      render(<Footer />);
      const footer = screen.getByRole("contentinfo");
      expect(footer.children.length).toBe(0);
      expect(footer.childNodes.length).toBe(1);
      expect(footer.childNodes[0].nodeType).toBe(Node.TEXT_NODE);
    });

    it("does not render any links or buttons", () => {
      render(<Footer />);
      expect(screen.queryAllByRole("link").length).toBe(0);
      expect(screen.queryAllByRole("button").length).toBe(0);
    });
  });

  describe("styling", () => {
    it("uses muted text color for subtlety", () => {
      render(<Footer />);
      const footer = screen.getByRole("contentinfo");
      expect(footer.className).toContain("text-surface-500");
    });

    it("centers text and uses small font size", () => {
      render(<Footer />);
      const footer = screen.getByRole("contentinfo");
      expect(footer.className).toContain("text-center");
      expect(footer.className).toContain("text-xs");
    });

    it("prevents shrinking in flex layout", () => {
      render(<Footer />);
      const footer = screen.getByRole("contentinfo");
      expect(footer.className).toContain("shrink-0");
    });
  });

  describe("i18n translation keys", () => {
    it("has footer.madeBy key in English with correct value", () => {
      expect(en.footer).toBeDefined();
      expect(en.footer.madeBy).toBe("Made by Stefan Savevski");
    });

    it("has footer.madeBy key in Macedonian with correct value", () => {
      expect(mk.footer).toBeDefined();
      expect(mk.footer.madeBy).toBe("Направено од Стефан Савевски");
    });

    it("has the same translation keys in both locales", () => {
      const enKeys = Object.keys(en.footer).sort();
      const mkKeys = Object.keys(mk.footer).sort();
      expect(enKeys).toEqual(mkKeys);
    });

    it("contains the author name in both locales", () => {
      expect(en.footer.madeBy).toContain("Stefan Savevski");
      expect(mk.footer.madeBy).toContain("Стефан Савевски");
    });

    it("has non-empty values for all translation keys", () => {
      for (const value of Object.values(en.footer)) {
        expect(typeof value).toBe("string");
        expect((value as string).length).toBeGreaterThan(0);
      }
      for (const value of Object.values(mk.footer)) {
        expect(typeof value).toBe("string");
        expect((value as string).length).toBeGreaterThan(0);
      }
    });
  });
});
