/**
 * CheckEmailPage & CheckEmailClient Unit Tests
 *
 * Tests the check-email page Suspense wrapper, client component rendering,
 * resend verification flow, cooldown timer, error handling, double-click
 * prevention, fetch request shape, and navigation links.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";

// ===== Mocks =====

// Track the mock searchParams getter so tests can configure the email param
let mockEmail: string | null = "test@example.com";

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === "email" ? mockEmail : null),
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Import the client component directly (page.tsx just wraps it in Suspense)
import CheckEmailClient from "../CheckEmailClient";

// ===== Tests =====

describe("CheckEmailClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmail = "test@example.com";
    vi.stubGlobal("fetch", vi.fn());
  });

  // ----- Rendering -----

  describe("Rendering", () => {
    it("renders the page heading", () => {
      render(<CheckEmailClient />);
      expect(screen.getByText("Check Your Email")).toBeTruthy();
    });

    it("renders email from search params", () => {
      render(<CheckEmailClient />);
      expect(screen.getByText("test@example.com")).toBeTruthy();
    });

    it("renders the verification instruction text", () => {
      render(<CheckEmailClient />);
      expect(
        screen.getByText(/Click the link to activate your account/)
      ).toBeTruthy();
    });

    it("renders the sent-to text including the email", () => {
      render(<CheckEmailClient />);
      expect(
        screen.getByText(/We sent a verification link to/)
      ).toBeTruthy();
    });

    it('renders fallback text "your email" when no email param', () => {
      mockEmail = null;
      render(<CheckEmailClient />);
      expect(screen.getByText("your email")).toBeTruthy();
    });

    it('renders fallback text "your email" when email param is empty string', () => {
      mockEmail = "";
      render(<CheckEmailClient />);
      expect(screen.getByText("your email")).toBeTruthy();
    });

    it("renders email with special characters correctly", () => {
      mockEmail = "user+tag@example.co.uk";
      render(<CheckEmailClient />);
      expect(screen.getByText("user+tag@example.co.uk")).toBeTruthy();
    });

    it("does not show error message initially", () => {
      render(<CheckEmailClient />);
      expect(screen.queryByText(/Failed to resend/)).toBeNull();
      expect(screen.queryByText(/Too many requests/)).toBeNull();
    });

    it("does not show success message initially", () => {
      render(<CheckEmailClient />);
      expect(screen.queryByText("Verification email resent!")).toBeNull();
    });
  });

  // ----- Resend button states -----

  describe("Resend button", () => {
    it("starts enabled with correct text", () => {
      render(<CheckEmailClient />);
      const button = screen.getByRole("button", {
        name: "Resend Verification Email",
      });
      expect(button).toBeTruthy();
      expect(button.hasAttribute("disabled")).toBe(false);
    });

    it('shows "Sending..." state after click', async () => {
      // Make fetch hang so we can observe the sending state
      const fetchMock = vi.fn(
        () => new Promise<Response>(() => {})
      );
      vi.stubGlobal("fetch", fetchMock);

      render(<CheckEmailClient />);

      fireEvent.click(
        screen.getByRole("button", { name: "Resend Verification Email" })
      );

      await waitFor(() => {
        const button = screen.getByRole("button", { name: "Sending..." });
        expect(button).toBeTruthy();
        expect(button.hasAttribute("disabled")).toBe(true);
      });
    });

    it("shows cooldown after successful resend", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<CheckEmailClient />);

      fireEvent.click(
        screen.getByRole("button", { name: "Resend Verification Email" })
      );

      await waitFor(() => {
        const button = screen.getByRole("button", { name: /Resend in 60s/ });
        expect(button).toBeTruthy();
        expect(button.hasAttribute("disabled")).toBe(true);
      });
    });

    it("cooldown timer counts down after one tick", async () => {
      vi.useFakeTimers();

      const fetchMock = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        })
      );
      vi.stubGlobal("fetch", fetchMock);

      render(<CheckEmailClient />);

      // Click the button and flush microtasks
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Resend Verification Email" })
        );
      });

      // Should show 60s cooldown
      expect(screen.getByRole("button", { name: /Resend in 60s/ })).toBeTruthy();

      // Advance 1 second — should show 59s
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByRole("button", { name: /Resend in 59s/ })).toBeTruthy();

      vi.useRealTimers();
    });

    it("button re-enables after full cooldown expires", async () => {
      vi.useFakeTimers();

      const fetchMock = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        })
      );
      vi.stubGlobal("fetch", fetchMock);

      render(<CheckEmailClient />);

      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Resend Verification Email" })
        );
      });

      expect(screen.getByRole("button", { name: /Resend in 60s/ })).toBeTruthy();

      // Advance through entire cooldown (60 seconds)
      for (let i = 0; i < 60; i++) {
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });
      }

      const button = screen.getByRole("button", {
        name: "Resend Verification Email",
      });
      expect(button).toBeTruthy();
      expect(button.hasAttribute("disabled")).toBe(false);

      vi.useRealTimers();
    });

    it("prevents double-click during sending state", async () => {
      const fetchMock = vi.fn(
        () => new Promise<Response>(() => {})
      );
      vi.stubGlobal("fetch", fetchMock);

      render(<CheckEmailClient />);

      fireEvent.click(
        screen.getByRole("button", { name: "Resend Verification Email" })
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Sending..." })).toBeTruthy();
      });

      // Click again while sending
      fireEvent.click(screen.getByRole("button", { name: "Sending..." }));

      // Should only have been called once
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("prevents click during cooldown", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<CheckEmailClient />);

      fireEvent.click(
        screen.getByRole("button", { name: "Resend Verification Email" })
      );

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Resend in/ })).toBeTruthy();
      });

      // Try clicking during cooldown — button is disabled so handler guards it
      fireEvent.click(screen.getByRole("button", { name: /Resend in/ }));

      // Should only have been called once (initial click)
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  // ----- Fetch request shape -----

  describe("Fetch request", () => {
    it("sends POST to /api/auth/resend-verification", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<CheckEmailClient />);

      fireEvent.click(
        screen.getByRole("button", { name: "Resend Verification Email" })
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith("/api/auth/resend-verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "test@example.com" }),
        });
      });
    });

    it("sends correct email from search params in request body", async () => {
      mockEmail = "other@domain.com";
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<CheckEmailClient />);

      fireEvent.click(
        screen.getByRole("button", { name: "Resend Verification Email" })
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/auth/resend-verification",
          expect.objectContaining({
            body: JSON.stringify({ email: "other@domain.com" }),
          })
        );
      });
    });

    it("sends empty email when no email param", async () => {
      mockEmail = null;
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<CheckEmailClient />);

      fireEvent.click(
        screen.getByRole("button", { name: "Resend Verification Email" })
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/auth/resend-verification",
          expect.objectContaining({
            body: JSON.stringify({ email: "" }),
          })
        );
      });
    });
  });

  // ----- Success message -----

  describe("Success state", () => {
    it("shows success message after successful resend", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<CheckEmailClient />);

      fireEvent.click(
        screen.getByRole("button", { name: "Resend Verification Email" })
      );

      await waitFor(() => {
        expect(screen.getByText("Verification email resent!")).toBeTruthy();
      });
    });

    it("does not show error message on success", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<CheckEmailClient />);

      fireEvent.click(
        screen.getByRole("button", { name: "Resend Verification Email" })
      );

      await waitFor(() => {
        expect(screen.getByText("Verification email resent!")).toBeTruthy();
      });

      expect(screen.queryByText(/Failed to resend/)).toBeNull();
      expect(screen.queryByText(/Too many requests/)).toBeNull();
    });
  });

  // ----- Error handling -----

  describe("Error handling", () => {
    it("shows error message on 429 response", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: () =>
          Promise.resolve({ error: "Too many requests. Please wait 60 seconds." }),
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<CheckEmailClient />);

      fireEvent.click(
        screen.getByRole("button", { name: "Resend Verification Email" })
      );

      await waitFor(() => {
        expect(
          screen.getByText("Too many requests. Please wait 60 seconds.")
        ).toBeTruthy();
      });
    });

    it("shows fallback message on 429 with no error field", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({}),
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<CheckEmailClient />);

      fireEvent.click(
        screen.getByRole("button", { name: "Resend Verification Email" })
      );

      await waitFor(() => {
        expect(
          screen.getByText("Please wait before resending.")
        ).toBeTruthy();
      });
    });

    it("shows error on non-429 server error (e.g. 500)", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Internal server error" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<CheckEmailClient />);

      fireEvent.click(
        screen.getByRole("button", { name: "Resend Verification Email" })
      );

      await waitFor(() => {
        expect(
          screen.getByText("Failed to resend. Please try again.")
        ).toBeTruthy();
      });

      // Should NOT show success message
      expect(screen.queryByText("Verification email resent!")).toBeNull();
    });

    it("shows error on 400 bad request", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "Bad request" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<CheckEmailClient />);

      fireEvent.click(
        screen.getByRole("button", { name: "Resend Verification Email" })
      );

      await waitFor(() => {
        expect(
          screen.getByText("Failed to resend. Please try again.")
        ).toBeTruthy();
      });
    });

    it("shows generic error on network failure", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("Network error"));
      vi.stubGlobal("fetch", fetchMock);

      render(<CheckEmailClient />);

      fireEvent.click(
        screen.getByRole("button", { name: "Resend Verification Email" })
      );

      await waitFor(() => {
        expect(
          screen.getByText("Failed to resend. Please try again.")
        ).toBeTruthy();
      });
    });

    it("re-enables button after error (no cooldown)", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("Network error"));
      vi.stubGlobal("fetch", fetchMock);

      render(<CheckEmailClient />);

      fireEvent.click(
        screen.getByRole("button", { name: "Resend Verification Email" })
      );

      await waitFor(() => {
        expect(
          screen.getByText("Failed to resend. Please try again.")
        ).toBeTruthy();
      });

      // Button should be re-enabled (no cooldown on error)
      const button = screen.getByRole("button", {
        name: "Resend Verification Email",
      });
      expect(button.hasAttribute("disabled")).toBe(false);
    });

    it("re-enables button after 429 error (no cooldown)", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: () =>
          Promise.resolve({ error: "Too many requests." }),
      });
      vi.stubGlobal("fetch", fetchMock);

      render(<CheckEmailClient />);

      fireEvent.click(
        screen.getByRole("button", { name: "Resend Verification Email" })
      );

      await waitFor(() => {
        expect(screen.getByText("Too many requests.")).toBeTruthy();
      });

      // Button should be re-enabled (no cooldown on 429)
      const button = screen.getByRole("button", {
        name: "Resend Verification Email",
      });
      expect(button.hasAttribute("disabled")).toBe(false);
    });

    it("clears previous error message on retry", async () => {
      // First call: error, second call: success
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ success: true }),
        });
      vi.stubGlobal("fetch", fetchMock);

      render(<CheckEmailClient />);

      // First click — triggers error
      fireEvent.click(
        screen.getByRole("button", { name: "Resend Verification Email" })
      );

      await waitFor(() => {
        expect(
          screen.getByText("Failed to resend. Please try again.")
        ).toBeTruthy();
      });

      // Second click — should clear error and succeed
      fireEvent.click(
        screen.getByRole("button", { name: "Resend Verification Email" })
      );

      await waitFor(() => {
        expect(screen.getByText("Verification email resent!")).toBeTruthy();
      });

      // Error message should be gone
      expect(
        screen.queryByText("Failed to resend. Please try again.")
      ).toBeNull();
    });

    it("does not show success message on error", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("Network error"));
      vi.stubGlobal("fetch", fetchMock);

      render(<CheckEmailClient />);

      fireEvent.click(
        screen.getByRole("button", { name: "Resend Verification Email" })
      );

      await waitFor(() => {
        expect(
          screen.getByText("Failed to resend. Please try again.")
        ).toBeTruthy();
      });

      expect(screen.queryByText("Verification email resent!")).toBeNull();
    });
  });

  // ----- Navigation link -----

  describe("Navigation", () => {
    it('shows "Register again" link pointing to /register', () => {
      render(<CheckEmailClient />);
      const link = screen.getByText("Register again");
      expect(link).toBeTruthy();
      expect(link.getAttribute("href")).toBe("/register");
    });

    it('displays "Wrong email?" prompt text', () => {
      render(<CheckEmailClient />);
      expect(screen.getByText(/Wrong email\?/)).toBeTruthy();
    });
  });
});

// ----- Page-level Suspense wrapper tests -----

describe("CheckEmailPage (Suspense wrapper)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmail = "test@example.com";
    vi.stubGlobal("fetch", vi.fn());
  });

  it("page.tsx renders CheckEmailClient content within Suspense", async () => {
    const pageMod = await import("../page");
    const Page = pageMod.default;

    render(<Page />);

    // The page should render the same content as CheckEmailClient
    expect(screen.getByText("Check Your Email")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Resend Verification Email" })).toBeTruthy();
  });

  it("page.tsx renders email from search params within Suspense", async () => {
    const pageMod = await import("../page");
    const Page = pageMod.default;

    render(<Page />);

    // Verify search params are accessible through Suspense boundary
    expect(screen.getByText("test@example.com")).toBeTruthy();
  });
});
