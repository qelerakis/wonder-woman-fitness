/**
 * Button Unit Tests
 *
 * Tests all button variants (including success), sizes,
 * loading states, disabled states, and className passthrough.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "../Button";

// ===== Tests =====

describe("Button", () => {
  // ─── Variant classes ─────────────────────────────────────────

  it("renders primary variant classes by default", () => {
    render(<Button>Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("bg-primary-600");
    expect(btn.className).toContain("text-white");
  });

  it("renders secondary variant classes", () => {
    render(<Button variant="secondary">Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("bg-surface-700");
    expect(btn.className).toContain("border-surface-600");
  });

  it("renders danger variant classes", () => {
    render(<Button variant="danger">Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("bg-error-600");
    expect(btn.className).toContain("text-white");
  });

  it("renders success variant classes", () => {
    render(<Button variant="success">Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("bg-success-600");
    expect(btn.className).toContain("text-white");
  });

  it("renders success variant hover class", () => {
    render(<Button variant="success">Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("hover:bg-success-700");
  });

  it("renders success variant focus ring class", () => {
    render(<Button variant="success">Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("focus-visible:ring-success-500");
  });

  it("renders success variant disabled class", () => {
    render(<Button variant="success">Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("disabled:bg-success-600/50");
  });

  it("renders ghost variant classes", () => {
    render(<Button variant="ghost">Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("bg-transparent");
    expect(btn.className).toContain("text-surface-300");
  });

  // ─── Size classes ────────────────────────────────────────────

  it("renders md size by default", () => {
    render(<Button>Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("px-4");
    expect(btn.className).toContain("py-2");
  });

  it("renders sm size classes", () => {
    render(<Button size="sm">Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("px-3");
    expect(btn.className).toContain("py-1.5");
  });

  it("renders lg size classes", () => {
    render(<Button size="lg">Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("px-6");
    expect(btn.className).toContain("py-3");
  });

  // ─── Disabled state ──────────────────────────────────────────

  it("sets disabled attribute when disabled prop is true", () => {
    render(<Button disabled>Click</Button>);
    const btn = screen.getByText("Click").closest("button")!;
    expect(btn.disabled).toBe(true);
  });

  it("sets disabled attribute when loading is true", () => {
    render(<Button loading>Click</Button>);
    const btn = screen.getByText("Click").closest("button")!;
    expect(btn.disabled).toBe(true);
  });

  // ─── Loading spinner ────────────────────────────────────────

  it("renders spinner when loading", () => {
    const { container } = render(<Button loading>Click</Button>);
    // Spinner component renders an SVG with animate
    const spinner = container.querySelector("svg");
    expect(spinner).toBeTruthy();
  });

  it("does not render spinner when not loading", () => {
    const { container } = render(<Button>Click</Button>);
    const svgs = container.querySelectorAll("svg");
    const spinner = Array.from(svgs).find((svg) =>
      svg.classList.contains("animate-spin")
    );
    expect(spinner).toBeUndefined();
  });

  // ─── Full width ──────────────────────────────────────────────

  it("applies w-full class when fullWidth is true", () => {
    render(<Button fullWidth>Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("w-full");
  });

  it("does not apply w-full class by default", () => {
    render(<Button>Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).not.toContain("w-full");
  });

  // ─── Custom className ────────────────────────────────────────

  it("applies custom className", () => {
    render(<Button className="ring-2 ring-success-500/50">Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("ring-2");
    expect(btn.className).toContain("ring-success-500/50");
  });

  // ─── Base classes ────────────────────────────────────────────

  it("always has base layout classes", () => {
    render(<Button>Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("inline-flex");
    expect(btn.className).toContain("items-center");
    expect(btn.className).toContain("rounded-lg");
    expect(btn.className).toContain("font-medium");
  });

  // ─── Click handler ───────────────────────────────────────────

  it("calls onClick handler when clicked", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Click" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not call onClick when disabled", () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByText("Click").closest("button")!);
    expect(onClick).not.toHaveBeenCalled();
  });

  // ─── Children ────────────────────────────────────────────────

  it("renders children content", () => {
    render(<Button>Submit Form</Button>);
    expect(screen.getByText("Submit Form")).toBeTruthy();
  });

  it("renders children with icons (SVG + text)", () => {
    render(
      <Button>
        <svg data-testid="icon" className="h-4 w-4" />
        Save
      </Button>
    );
    expect(screen.getByTestId("icon")).toBeTruthy();
    expect(screen.getByText("Save")).toBeTruthy();
  });

  // ─── Hover classes per variant ─────────────────────────────────

  it("renders primary variant hover class", () => {
    render(<Button variant="primary">Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("hover:bg-primary-700");
  });

  it("renders danger variant hover class", () => {
    render(<Button variant="danger">Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("hover:bg-error-700");
  });

  it("renders secondary variant hover class", () => {
    render(<Button variant="secondary">Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("hover:bg-surface-600");
  });

  it("renders ghost variant hover classes", () => {
    render(<Button variant="ghost">Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("hover:bg-surface-800");
    expect(btn.className).toContain("hover:text-surface-100");
  });

  // ─── Focus ring per variant ────────────────────────────────────

  it("renders primary variant focus ring", () => {
    render(<Button variant="primary">Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("focus-visible:ring-primary-500");
  });

  it("renders danger variant focus ring", () => {
    render(<Button variant="danger">Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("focus-visible:ring-error-500");
  });

  it("renders secondary variant focus ring", () => {
    render(<Button variant="secondary">Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("focus-visible:ring-surface-500");
  });

  // ─── Disabled classes per variant ──────────────────────────────

  it("renders primary variant disabled class", () => {
    render(<Button variant="primary">Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("disabled:bg-primary-600/50");
  });

  it("renders danger variant disabled class", () => {
    render(<Button variant="danger">Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("disabled:bg-error-600/50");
  });

  it("renders secondary variant disabled class", () => {
    render(<Button variant="secondary">Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("disabled:bg-surface-700/50");
  });

  it("renders ghost variant disabled class", () => {
    render(<Button variant="ghost">Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("disabled:text-surface-500");
  });

  // ─── Common disabled/transition classes ────────────────────────

  it("always has disabled cursor and opacity classes", () => {
    render(<Button>Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("disabled:cursor-not-allowed");
    expect(btn.className).toContain("disabled:opacity-60");
  });

  it("always has transition classes", () => {
    render(<Button>Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("transition-colors");
    expect(btn.className).toContain("duration-150");
  });

  // ─── Focus ring offset ─────────────────────────────────────────

  it("has focus-visible ring offset for dark background", () => {
    render(<Button>Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("focus-visible:ring-2");
    expect(btn.className).toContain("focus-visible:ring-offset-2");
    expect(btn.className).toContain("focus-visible:ring-offset-surface-900");
  });

  // ─── Secondary variant border ──────────────────────────────────

  it("renders secondary variant with border", () => {
    render(<Button variant="secondary">Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("border");
    expect(btn.className).toContain("border-surface-600");
  });

  it("does not render border for primary variant", () => {
    render(<Button variant="primary">Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    // Primary doesn't have `border` in its classes (only base classes)
    expect(btn.className).not.toContain("border-surface-600");
  });

  // ─── Gap class for icon + text ─────────────────────────────────

  it("has gap-2 class for icon spacing", () => {
    render(<Button>Click</Button>);
    const btn = screen.getByRole("button", { name: "Click" });
    expect(btn.className).toContain("gap-2");
  });
});
