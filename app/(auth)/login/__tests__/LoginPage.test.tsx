/**
 * LoginPage Unit Tests
 *
 * Tests the login page rendering, form submission, error display,
 * verification hint feature, loading state, and navigation links.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ===== Mocks =====

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
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

const mockSignIn = vi.fn();

vi.mock("next-auth/react", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

// Import the component after mocks are set up
import LoginPage from "../page";

// ===== Tests =====

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  // ----- Rendering -----

  it("renders sign-in form with email input, password input, and Sign In button", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeTruthy();
  });

  // ----- Error on invalid credentials -----

  it("shows error on invalid credentials", async () => {
    mockSignIn.mockResolvedValue({ error: "CredentialsSignin" });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrongpassword" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(screen.getByText("Invalid email or password")).toBeTruthy();
    });
  });

  // ----- Verification hint after failed login -----

  it("shows verification hint after failed login", async () => {
    mockSignIn.mockResolvedValue({ error: "CredentialsSignin" });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "newuser@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(screen.getByText("Recently registered?")).toBeTruthy();
    });
  });

  // ----- Verification hint link has correct href -----

  it("verification hint links to check-email with encoded email", async () => {
    mockSignIn.mockResolvedValue({ error: "CredentialsSignin" });

    render(<LoginPage />);

    const testEmail = "user+test@example.com";

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: testEmail },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      const link = screen.getByText("Resend verification email");
      expect(link).toBeTruthy();
      expect(link.getAttribute("href")).toBe(
        `/check-email?email=${encodeURIComponent(testEmail)}`
      );
    });
  });

  // ----- Verification hint not shown initially -----

  it("does not show verification hint before any submission", () => {
    render(<LoginPage />);

    expect(screen.queryByText("Recently registered?")).toBeNull();
  });

  // ----- Loading state during sign-in -----

  it("shows loading state during sign-in", async () => {
    // Make signIn hang so we can observe the loading state
    mockSignIn.mockImplementation(() => new Promise(() => {}));

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      const button = screen.getByRole("button", { name: "Signing in..." });
      expect(button).toBeTruthy();
      expect(button.hasAttribute("disabled")).toBe(true);
    });
  });

  // ----- Register link -----

  it("shows Register link pointing to /register", () => {
    render(<LoginPage />);

    const link = screen.getByText("Register");
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/register");
  });

  // ----- Forgot password link -----

  it('shows "Forgot your password?" link pointing to /forgot-password', () => {
    render(<LoginPage />);

    const link = screen.getByText("Forgot your password?");
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe("/forgot-password");
  });

  // ----- Successful login redirects -----

  it("redirects OWNER to /dashboard after successful login", async () => {
    mockSignIn.mockResolvedValue({ error: null });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ user: { role: "OWNER" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("redirects TRAINER to /my-schedule after successful login", async () => {
    mockSignIn.mockResolvedValue({ error: null });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ user: { role: "TRAINER" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "trainer@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/my-schedule");
    });
  });

  it("redirects MEMBER to /member/schedule after successful login", async () => {
    mockSignIn.mockResolvedValue({ error: null });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ user: { role: "MEMBER" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "member@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/member/schedule");
    });
  });

  // ----- Unexpected error handling -----

  it("shows unexpected error message when signIn throws", async () => {
    mockSignIn.mockRejectedValue(new Error("Network failure"));

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(screen.getByText("An unexpected error occurred")).toBeTruthy();
    });
  });

  // ----- Error clears on resubmit -----

  it("clears previous error when form is resubmitted", async () => {
    // First attempt fails
    mockSignIn.mockResolvedValueOnce({ error: "CredentialsSignin" });
    // Second attempt hangs (so we can check error was cleared)
    mockSignIn.mockImplementationOnce(() => new Promise(() => {}));

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrongpassword" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(screen.getByText("Invalid email or password")).toBeTruthy();
    });

    // Submit again
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(screen.queryByText("Invalid email or password")).toBeNull();
    });
  });
});
