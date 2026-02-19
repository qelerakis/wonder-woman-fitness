/**
 * CheckEmailPage Unit Tests
 *
 * Tests the check-email page rendering, resend verification flow,
 * cooldown timer, error handling, and navigation links.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

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

// Import the component after mocks are set up
import CheckEmailPage from "../page";

// ===== Tests =====

describe("CheckEmailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmail = "test@example.com";
    vi.stubGlobal("fetch", vi.fn());
  });

  // ----- Rendering with email param -----

  it("renders email from search params", () => {
    render(<CheckEmailPage />);
    expect(screen.getByText("test@example.com")).toBeTruthy();
  });

  it('renders fallback text "your email" when no email param', () => {
    mockEmail = null;
    render(<CheckEmailPage />);
    expect(screen.getByText("your email")).toBeTruthy();
  });

  // ----- Resend button states -----

  it("resend button starts enabled with correct text", () => {
    render(<CheckEmailPage />);
    const button = screen.getByRole("button", {
      name: "Resend Verification Email",
    });
    expect(button).toBeTruthy();
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it('resend button shows "Sending..." state after click', async () => {
    // Make fetch hang so we can observe the sending state
    const fetchMock = vi.fn(
      () => new Promise<Response>(() => {})
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<CheckEmailPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Resend Verification Email" })
    );

    await waitFor(() => {
      const button = screen.getByRole("button", { name: "Sending..." });
      expect(button).toBeTruthy();
      expect(button.hasAttribute("disabled")).toBe(true);
    });
  });

  it("resend button shows cooldown after successful resend", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CheckEmailPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Resend Verification Email" })
    );

    await waitFor(() => {
      const button = screen.getByRole("button", { name: /Resend in 60s/ });
      expect(button).toBeTruthy();
      expect(button.hasAttribute("disabled")).toBe(true);
    });
  });

  // ----- Success message -----

  it("shows success message after successful resend", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CheckEmailPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Resend Verification Email" })
    );

    await waitFor(() => {
      expect(screen.getByText("Verification email resent!")).toBeTruthy();
    });
  });

  // ----- Error handling -----

  it("shows error message on 429 response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: () =>
        Promise.resolve({ error: "Too many requests. Please wait 60 seconds." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CheckEmailPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Resend Verification Email" })
    );

    await waitFor(() => {
      expect(
        screen.getByText("Too many requests. Please wait 60 seconds.")
      ).toBeTruthy();
    });
  });

  it("shows generic error on network failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", fetchMock);

    render(<CheckEmailPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Resend Verification Email" })
    );

    await waitFor(() => {
      expect(
        screen.getByText("Failed to resend. Please try again.")
      ).toBeTruthy();
    });
  });

  // ----- Navigation link -----

  it('shows "Register again" link pointing to /register', () => {
    render(<CheckEmailPage />);
    const link = screen.getByText("Register again");
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/register");
  });
});
