/**
 * AuthLayout Unit Tests
 *
 * Tests the auth layout rendering, language toggle presence,
 * brand display, children rendering, positioning, and accessibility.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AuthLayout from "../layout";

// ===== Mocks =====

// Mock LanguageToggle to isolate layout testing
vi.mock("@/components/layout/LanguageToggle", () => ({
  LanguageToggle: () => (
    <div data-testid="language-toggle">
      <button aria-label="Switch to Macedonian">МК</button>
      <button aria-label="Switch to English">EN</button>
    </div>
  ),
}));

// Mock LazyAuthBackground to render on server during tests
vi.mock("@/components/layout/LazyAuthBackground", () => ({
  LazyAuthBackground: () => (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      data-testid="auth-background"
    />
  ),
}));

// ===== Helpers =====

async function renderAuthLayout(children?: React.ReactNode) {
  const jsx = await AuthLayout({
    children: children ?? <div data-testid="child-content">Test Child</div>,
  });
  return render(jsx);
}

// ===== Tests =====

describe("AuthLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ----- Language Toggle -----

  describe("Language Toggle", () => {
    it("renders the LanguageToggle component", async () => {
      await renderAuthLayout();
      expect(screen.getByTestId("language-toggle")).toBeTruthy();
    });

    it("renders both MK and EN language buttons", async () => {
      await renderAuthLayout();
      expect(screen.getByLabelText("Switch to Macedonian")).toBeTruthy();
      expect(screen.getByLabelText("Switch to English")).toBeTruthy();
    });

    it("positions the toggle in a container with absolute positioning", async () => {
      await renderAuthLayout();
      const toggle = screen.getByTestId("language-toggle");
      const wrapper = toggle.parentElement!;
      expect(wrapper.className).toContain("absolute");
      expect(wrapper.className).toContain("top-4");
      expect(wrapper.className).toContain("right-4");
    });

    it("applies z-10 to the toggle wrapper for proper stacking", async () => {
      await renderAuthLayout();
      const toggle = screen.getByTestId("language-toggle");
      const wrapper = toggle.parentElement!;
      expect(wrapper.className).toContain("z-10");
    });
  });

  // ----- Brand Display -----

  describe("Brand Display", () => {
    it("renders the brand name as a heading", async () => {
      await renderAuthLayout();
      const heading = screen.getByRole("heading", {
        name: "Wonder Woman Fitness",
      });
      expect(heading).toBeTruthy();
      expect(heading.tagName).toBe("H1");
    });

    it("renders the brand tagline", async () => {
      await renderAuthLayout();
      expect(screen.getByText("Studio Management Platform")).toBeTruthy();
    });

    it("applies primary color to the brand name", async () => {
      await renderAuthLayout();
      const heading = screen.getByRole("heading", {
        name: "Wonder Woman Fitness",
      });
      expect(heading.className).toContain("text-primary-400");
    });

    it("applies muted color to the tagline", async () => {
      await renderAuthLayout();
      const tagline = screen.getByText("Studio Management Platform");
      expect(tagline.className).toContain("text-surface-400");
    });

    it("centers the brand section", async () => {
      await renderAuthLayout();
      const heading = screen.getByRole("heading", {
        name: "Wonder Woman Fitness",
      });
      const brandSection = heading.parentElement!;
      expect(brandSection.className).toContain("text-center");
    });
  });

  // ----- Children Rendering -----

  describe("Children Rendering", () => {
    it("renders children inside the auth card", async () => {
      await renderAuthLayout(
        <form data-testid="login-form">
          <input type="email" />
        </form>
      );
      expect(screen.getByTestId("login-form")).toBeTruthy();
    });

    it("wraps children in the styled card container", async () => {
      await renderAuthLayout(<div data-testid="child-content">Content</div>);
      const child = screen.getByTestId("child-content");
      const card = child.parentElement!;
      expect(card.className).toContain("rounded-xl");
      expect(card.className).toContain("border");
      expect(card.className).toContain("bg-surface-900");
      expect(card.className).toContain("p-8");
      expect(card.className).toContain("shadow-lg");
    });

    it("renders complex children correctly", async () => {
      await renderAuthLayout(
        <>
          <h2>Sign In</h2>
          <input type="email" placeholder="Email" />
          <button type="submit">Submit</button>
        </>
      );
      expect(screen.getByText("Sign In")).toBeTruthy();
      expect(screen.getByPlaceholderText("Email")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Submit" })).toBeTruthy();
    });
  });

  // ----- Layout Structure -----

  describe("Layout Structure", () => {
    it("uses full-screen height with centered content", async () => {
      const { container } = await renderAuthLayout();
      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv.className).toContain("flex-1");
      expect(outerDiv.className).toContain("flex");
      expect(outerDiv.className).toContain("items-center");
      expect(outerDiv.className).toContain("justify-center");
    });

    it("applies dark background to the page", async () => {
      const { container } = await renderAuthLayout();
      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv.className).toContain("bg-surface-950");
    });

    it("uses relative positioning on the outer container for absolute toggle", async () => {
      const { container } = await renderAuthLayout();
      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv.className).toContain("relative");
    });

    it("constrains content width with max-w-md", async () => {
      await renderAuthLayout();
      const heading = screen.getByRole("heading", {
        name: "Wonder Woman Fitness",
      });
      const contentWrapper = heading.parentElement!.parentElement!;
      expect(contentWrapper.className).toContain("max-w-md");
      expect(contentWrapper.className).toContain("w-full");
    });

    it("adds horizontal padding for mobile", async () => {
      const { container } = await renderAuthLayout();
      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv.className).toContain("px-4");
    });
  });

  // ----- Mobile Responsiveness -----

  describe("Mobile Responsiveness", () => {
    it("adds top padding on mobile to prevent toggle overlap", async () => {
      await renderAuthLayout();
      const heading = screen.getByRole("heading", {
        name: "Wonder Woman Fitness",
      });
      const contentWrapper = heading.parentElement!.parentElement!;
      expect(contentWrapper.className).toContain("pt-14");
    });

    it("removes top padding on sm breakpoint and above", async () => {
      await renderAuthLayout();
      const heading = screen.getByRole("heading", {
        name: "Wonder Woman Fitness",
      });
      const contentWrapper = heading.parentElement!.parentElement!;
      expect(contentWrapper.className).toContain("sm:pt-0");
    });
  });

  // ----- DOM Structure Order -----

  describe("DOM Structure Order", () => {
    it("renders toggle before the main content in DOM order", async () => {
      const { container } = await renderAuthLayout();
      const outerDiv = container.firstChild as HTMLElement;
      const children = Array.from(outerDiv.children);

      // children[0] = AuthBackground (mocked), children[1] = toggle, children[2] = content
      const toggleContainer = children[1] as HTMLElement;
      expect(
        toggleContainer.querySelector("[data-testid='language-toggle']")
      ).toBeTruthy();

      // Third child should contain the brand and card
      const contentContainer = children[2] as HTMLElement;
      expect(contentContainer.querySelector("h1")).toBeTruthy();
    });

    it("renders brand heading before the auth card", async () => {
      await renderAuthLayout(<div data-testid="card-child">Card</div>);

      const heading = screen.getByRole("heading", {
        name: "Wonder Woman Fitness",
      });
      const cardChild = screen.getByTestId("card-child");

      // heading should come before card child in document order
      const position = heading.compareDocumentPosition(cardChild);
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });
});
