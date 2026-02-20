/**
 * LockoutScreen Unit Tests
 *
 * Tests rendering, content display, and mobile UX styling
 * including full-width button classes for the Log Out button.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LockoutScreen } from "../LockoutScreen";

// ===== Mocks =====

vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

// ===== Tests =====

describe("LockoutScreen", () => {
  describe("rendering", () => {
    it("displays 'Account Locked' heading", () => {
      render(<LockoutScreen memberName="Alice" />);
      expect(screen.getByText("Account Locked")).toBeTruthy();
    });

    it("displays member name in the message", () => {
      render(<LockoutScreen memberName="Alice" />);
      expect(screen.getByText(/Hi Alice/)).toBeTruthy();
    });

    it("displays the three steps to restore access", () => {
      render(<LockoutScreen memberName="Alice" />);
      expect(screen.getByText(/Make your monthly payment/)).toBeTruthy();
      expect(screen.getByText(/owner will record your payment/)).toBeTruthy();
      expect(screen.getByText(/restored automatically/)).toBeTruthy();
    });

    it("displays owner email when provided", () => {
      render(<LockoutScreen memberName="Alice" ownerEmail="owner@gym.com" />);
      expect(screen.getByText("owner@gym.com")).toBeTruthy();
    });

    it("does not display contact section when ownerEmail is not provided", () => {
      render(<LockoutScreen memberName="Alice" />);
      expect(screen.queryByText("Questions?")).toBeNull();
    });

    it("renders Log Out button", () => {
      render(<LockoutScreen memberName="Alice" />);
      expect(screen.getByText("Log Out")).toBeTruthy();
    });
  });

  describe("mobile UX: Log Out button styling", () => {
    it("has full-width class (w-full)", () => {
      render(<LockoutScreen memberName="Alice" />);
      const logOutButton = screen.getByText("Log Out").closest("button")!;
      expect(logOutButton.className).toContain("w-full");
    });

    it("has justify-center class", () => {
      render(<LockoutScreen memberName="Alice" />);
      const logOutButton = screen.getByText("Log Out").closest("button")!;
      expect(logOutButton.className).toContain("justify-center");
    });

    it("has responsive override sm:w-auto", () => {
      render(<LockoutScreen memberName="Alice" />);
      const logOutButton = screen.getByText("Log Out").closest("button")!;
      expect(logOutButton.className).toContain("sm:w-auto");
    });

    it("has responsive override sm:justify-start", () => {
      render(<LockoutScreen memberName="Alice" />);
      const logOutButton = screen.getByText("Log Out").closest("button")!;
      expect(logOutButton.className).toContain("sm:justify-start");
    });

    it("has increased vertical padding (py-2.5)", () => {
      render(<LockoutScreen memberName="Alice" />);
      const logOutButton = screen.getByText("Log Out").closest("button")!;
      expect(logOutButton.className).toContain("py-2.5");
    });
  });
});
