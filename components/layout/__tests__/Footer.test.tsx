import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "../Footer";
import en from "../../../messages/en.json";
import mk from "../../../messages/mk.json";

describe("Footer", () => {
  describe("rendering", () => {
    it("renders the credit text", () => {
      render(<Footer />);
      expect(screen.getByText("Made by Stefan Savevski")).toBeTruthy();
    });

    it("renders inside a footer element", () => {
      render(<Footer />);
      const footer = screen.getByRole("contentinfo");
      expect(footer).toBeTruthy();
    });

    it("contains the credit text inside the footer element", () => {
      render(<Footer />);
      const footer = screen.getByRole("contentinfo");
      expect(footer.textContent).toBe("Made by Stefan Savevski");
    });

    it("renders exactly one footer element", () => {
      const { container } = render(<Footer />);
      const footers = container.querySelectorAll("footer");
      expect(footers.length).toBe(1);
    });

    it("does not render any links", () => {
      const { container } = render(<Footer />);
      const links = container.querySelectorAll("a");
      expect(links.length).toBe(0);
    });

    it("does not render any buttons", () => {
      const { container } = render(<Footer />);
      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBe(0);
    });

    it("renders only text content with no child elements", () => {
      render(<Footer />);
      const footer = screen.getByRole("contentinfo");
      expect(footer.children.length).toBe(0);
      expect(footer.childNodes.length).toBe(1);
      expect(footer.childNodes[0].nodeType).toBe(Node.TEXT_NODE);
    });
  });

  describe("styling", () => {
    it("applies full width class", () => {
      render(<Footer />);
      const footer = screen.getByRole("contentinfo");
      expect(footer.className).toContain("w-full");
    });

    it("applies vertical padding class", () => {
      render(<Footer />);
      const footer = screen.getByRole("contentinfo");
      expect(footer.className).toContain("py-4");
    });

    it("applies center text alignment class", () => {
      render(<Footer />);
      const footer = screen.getByRole("contentinfo");
      expect(footer.className).toContain("text-center");
    });

    it("applies extra-small text size class", () => {
      render(<Footer />);
      const footer = screen.getByRole("contentinfo");
      expect(footer.className).toContain("text-xs");
    });

    it("applies muted text color class", () => {
      render(<Footer />);
      const footer = screen.getByRole("contentinfo");
      expect(footer.className).toContain("text-surface-500");
    });

    it("has all expected classes and no others", () => {
      render(<Footer />);
      const footer = screen.getByRole("contentinfo");
      const classes = footer.className.split(/\s+/).sort();
      expect(classes).toEqual(
        ["py-4", "text-center", "text-surface-500", "text-xs", "w-full"].sort()
      );
    });
  });

  describe("i18n translation keys", () => {
    it("has footer.madeBy key in English translations", () => {
      expect(en.footer).toBeDefined();
      expect(en.footer.madeBy).toBe("Made by Stefan Savevski");
    });

    it("has footer.madeBy key in Macedonian translations", () => {
      expect(mk.footer).toBeDefined();
      expect(mk.footer.madeBy).toBe("Направено од Стефан Савевски");
    });

    it("has the same keys in both locales", () => {
      const enKeys = Object.keys(en.footer).sort();
      const mkKeys = Object.keys(mk.footer).sort();
      expect(enKeys).toEqual(mkKeys);
    });

    it("has non-empty values in both locales", () => {
      expect(en.footer.madeBy.length).toBeGreaterThan(0);
      expect(mk.footer.madeBy.length).toBeGreaterThan(0);
    });

    it("contains 'Stefan Savevski' in English translation", () => {
      expect(en.footer.madeBy).toContain("Stefan Savevski");
    });

    it("contains 'Стефан Савевски' in Macedonian translation", () => {
      expect(mk.footer.madeBy).toContain("Стефан Савевски");
    });
  });

  describe("accessibility", () => {
    it("uses semantic footer element for contentinfo landmark", () => {
      render(<Footer />);
      const footer = screen.getByRole("contentinfo");
      expect(footer.tagName).toBe("FOOTER");
    });

    it("has no interactive elements", () => {
      render(<Footer />);
      const interactive = screen.queryAllByRole("link");
      const buttons = screen.queryAllByRole("button");
      expect(interactive.length).toBe(0);
      expect(buttons.length).toBe(0);
    });

    it("has visible text content", () => {
      render(<Footer />);
      const footer = screen.getByRole("contentinfo");
      expect(footer.textContent).toBeTruthy();
      expect(footer.textContent!.trim().length).toBeGreaterThan(0);
    });
  });
});
