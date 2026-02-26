/**
 * ProfileClient Unit Tests
 *
 * Comprehensive tests for the ProfileClient component covering:
 * - Payment information section rendering (statuses, badges, alerts, dates)
 * - Status-specific behavior (PAID, GRACE_PERIOD, LOCKED, OVERRIDE, DEPARTED)
 * - Props passing to PaymentInfoSection
 * - Empty states (no payments, trial user)
 * - Show all payments toggle
 * - Profile form and payment section coexistence
 * - Profile form interactions (save, validation)
 * - Password change form (submit, validation)
 * - Edge cases (long names, null fields, departed user)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ===== Mocks =====

const mockRefresh = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    ...props
  }: {
    src: string;
    alt: string;
    width?: number;
    height?: number;
    className?: string;
  }) => <img src={src} alt={alt} {...props} />,
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

const mockAddToast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocks
import { ProfileClient } from "@/app/(member)/member/profile/ProfileClient";

// ===== Helpers =====

function fmtCurrency(amount: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(amount)} MKD`;
}

// ===== Test Data =====

const defaultUser = {
  id: "user-1",
  name: "Jane Doe",
  email: "jane@example.com",
  phone: "+38970123456" as string | null,
  photo: null as string | null,
  status: "ACTIVE" as const,
  joinDate: "2025-12-01T00:00:00.000Z",
  trialEndsAt: null as string | null,
};

const defaultPaymentInfo = {
  status: "PAID" as const,
  daysRemaining: null as number | null,
  lastPaymentDate: "2026-02-05T10:00:00.000Z" as string | null,
  paidThroughDate: "2026-02-28T00:00:00.000Z" as string | null,
  nextPaymentDue: "2026-03-01T00:00:00.000Z" as string | null,
  recentPayments: [
    {
      id: "p-1",
      amount: 1500,
      paidAt: "2026-02-05T10:00:00.000Z",
      periodStart: "2026-02-01T00:00:00.000Z",
      periodEnd: "2026-02-28T00:00:00.000Z",
    },
  ],
  totalPaymentCount: 1,
};

const trialUser = {
  ...defaultUser,
  status: "TRIAL" as const,
  trialEndsAt: "2026-03-15T00:00:00.000Z",
};

const departedUser = {
  ...defaultUser,
  status: "DEPARTED" as const,
};

const emptyPaymentInfo = {
  status: "GRACE_PERIOD" as const,
  daysRemaining: 14 as number | null,
  lastPaymentDate: null as string | null,
  paidThroughDate: null as string | null,
  nextPaymentDue: null as string | null,
  recentPayments: [] as typeof defaultPaymentInfo.recentPayments,
  totalPaymentCount: 0,
};

// ===== Tests =====

describe("ProfileClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  // ===== Payment Section Rendering =====

  describe("payment section rendering", () => {
    it("renders the Payment Information heading", () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );
      expect(screen.getByText("Payment Information")).toBeTruthy();
    });

    it("renders payment status badge for PAID status", () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );
      expect(screen.getByText("Paid")).toBeTruthy();
    });

    it("renders payment status badge for GRACE_PERIOD status", () => {
      render(
        <ProfileClient
          user={defaultUser}
          paymentInfo={{
            ...defaultPaymentInfo,
            status: "GRACE_PERIOD" as const,
            daysRemaining: 5,
          }}
        />
      );
      expect(screen.getByText("Grace Period")).toBeTruthy();
    });

    it("renders payment status badge for LOCKED status", () => {
      render(
        <ProfileClient
          user={defaultUser}
          paymentInfo={{
            ...defaultPaymentInfo,
            status: "LOCKED" as const,
            daysRemaining: 0,
          }}
        />
      );
      expect(screen.getByText("Locked")).toBeTruthy();
    });

    it("renders payment status badge for OVERRIDE status", () => {
      render(
        <ProfileClient
          user={defaultUser}
          paymentInfo={{
            ...defaultPaymentInfo,
            status: "OVERRIDE" as const,
          }}
        />
      );
      expect(screen.getByText("Override")).toBeTruthy();
    });

    it("renders payment status badge for DEPARTED status", () => {
      render(
        <ProfileClient
          user={departedUser}
          paymentInfo={{
            ...defaultPaymentInfo,
            status: "DEPARTED" as const,
          }}
        />
      );
      expect(screen.getByText("Departed")).toBeTruthy();
    });

    it("renders date info grid with all three dates when provided", () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );
      expect(screen.getByText("Last payment")).toBeTruthy();
      expect(screen.getByText("Paid through")).toBeTruthy();
      expect(screen.getByText("Next payment due")).toBeTruthy();
    });

    it("renders payment amounts in history", () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );
      expect(screen.getByText(fmtCurrency(1500))).toBeTruthy();
    });

    it("renders Recent Payments heading when payments exist", () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );
      expect(screen.getByText("Recent Payments")).toBeTruthy();
    });

    it("does not render Recent Payments heading when no payments", () => {
      render(
        <ProfileClient user={trialUser} paymentInfo={emptyPaymentInfo} />
      );
      expect(screen.queryByText("Recent Payments")).toBeNull();
    });

    it("renders multiple payment rows when multiple payments exist", () => {
      const multiPaymentInfo = {
        ...defaultPaymentInfo,
        recentPayments: [
          {
            id: "p-1",
            amount: 1500,
            paidAt: "2026-02-05T10:00:00.000Z",
            periodStart: "2026-02-01T00:00:00.000Z",
            periodEnd: "2026-02-28T00:00:00.000Z",
          },
          {
            id: "p-2",
            amount: 1200,
            paidAt: "2026-01-05T10:00:00.000Z",
            periodStart: "2026-01-01T00:00:00.000Z",
            periodEnd: "2026-01-31T00:00:00.000Z",
          },
        ],
        totalPaymentCount: 2,
      };

      render(
        <ProfileClient user={defaultUser} paymentInfo={multiPaymentInfo} />
      );
      expect(screen.getByText(fmtCurrency(1500))).toBeTruthy();
      expect(screen.getByText(fmtCurrency(1200))).toBeTruthy();
    });
  });

  // ===== Status-Specific Behavior =====

  describe("status-specific behavior", () => {
    it("PAID: shows Paid badge and no alert bar", () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );
      expect(screen.getByText("Paid")).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("GRACE_PERIOD + ACTIVE user: warning alert with days remaining to pay", () => {
      render(
        <ProfileClient
          user={defaultUser}
          paymentInfo={{
            ...defaultPaymentInfo,
            status: "GRACE_PERIOD" as const,
            daysRemaining: 5,
          }}
        />
      );
      expect(screen.getByText("Grace Period")).toBeTruthy();
      expect(screen.getByText("5 days remaining to pay")).toBeTruthy();
      expect(screen.getByRole("alert")).toBeTruthy();
    });

    it("GRACE_PERIOD + ACTIVE user: singular day form for 1 day remaining", () => {
      render(
        <ProfileClient
          user={defaultUser}
          paymentInfo={{
            ...defaultPaymentInfo,
            status: "GRACE_PERIOD" as const,
            daysRemaining: 1,
          }}
        />
      );
      expect(screen.getByText("1 day remaining to pay")).toBeTruthy();
    });

    it("GRACE_PERIOD + TRIAL user: warning alert with days remaining in trial", () => {
      render(
        <ProfileClient
          user={trialUser}
          paymentInfo={{
            ...defaultPaymentInfo,
            status: "GRACE_PERIOD" as const,
            daysRemaining: 10,
          }}
        />
      );
      expect(screen.getByText("Grace Period")).toBeTruthy();
      expect(screen.getByText("10 days remaining in trial")).toBeTruthy();
      expect(screen.getByRole("alert")).toBeTruthy();
    });

    it("GRACE_PERIOD + TRIAL user: singular day form for 1 day remaining in trial", () => {
      render(
        <ProfileClient
          user={trialUser}
          paymentInfo={{
            ...defaultPaymentInfo,
            status: "GRACE_PERIOD" as const,
            daysRemaining: 1,
          }}
        />
      );
      expect(screen.getByText("1 day remaining in trial")).toBeTruthy();
    });

    it("LOCKED: Locked badge and red alert with overdue message", () => {
      render(
        <ProfileClient
          user={defaultUser}
          paymentInfo={{
            ...defaultPaymentInfo,
            status: "LOCKED" as const,
            daysRemaining: 0,
          }}
        />
      );
      expect(screen.getByText("Locked")).toBeTruthy();
      // The exact translation from en.json
      expect(
        screen.getByText("Payment overdue \u2014 contact the owner")
      ).toBeTruthy();
      expect(screen.getByRole("alert")).toBeTruthy();
    });

    it("OVERRIDE: Override badge and purple alert with override message", () => {
      render(
        <ProfileClient
          user={defaultUser}
          paymentInfo={{
            ...defaultPaymentInfo,
            status: "OVERRIDE" as const,
          }}
        />
      );
      expect(screen.getByText("Override")).toBeTruthy();
      expect(screen.getByText("Payment override active")).toBeTruthy();
      expect(screen.getByRole("alert")).toBeTruthy();
    });

    it("DEPARTED: Departed badge and no alert bar", () => {
      render(
        <ProfileClient
          user={departedUser}
          paymentInfo={{
            ...defaultPaymentInfo,
            status: "DEPARTED" as const,
          }}
        />
      );
      expect(screen.getByText("Departed")).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  // ===== Props Passing to PaymentInfoSection =====

  describe("props passing to PaymentInfoSection", () => {
    it("passes user.status as userStatus for trial countdown text", () => {
      render(
        <ProfileClient
          user={trialUser}
          paymentInfo={{
            ...defaultPaymentInfo,
            status: "GRACE_PERIOD" as const,
            daysRemaining: 10,
          }}
        />
      );
      // When userStatus is TRIAL, the text says "remaining in trial" instead of "remaining to pay"
      expect(screen.getByText("10 days remaining in trial")).toBeTruthy();
      expect(screen.queryByText("10 days remaining to pay")).toBeNull();
    });

    it("passes user.trialEndsAt for trial end date display", () => {
      render(
        <ProfileClient
          user={trialUser}
          paymentInfo={{
            ...emptyPaymentInfo,
            status: "GRACE_PERIOD" as const,
            daysRemaining: 14,
          }}
        />
      );
      expect(screen.getByText("Trial ends on Mar 15, 2026")).toBeTruthy();
    });

    it("passes paymentInfo.status correctly for each status value", () => {
      const statuses = [
        "PAID",
        "GRACE_PERIOD",
        "LOCKED",
        "OVERRIDE",
        "DEPARTED",
      ] as const;
      const badgeTexts = [
        "Paid",
        "Grace Period",
        "Locked",
        "Override",
        "Departed",
      ];

      for (let i = 0; i < statuses.length; i++) {
        const { unmount } = render(
          <ProfileClient
            user={defaultUser}
            paymentInfo={{
              ...defaultPaymentInfo,
              status: statuses[i],
              daysRemaining: statuses[i] === "GRACE_PERIOD" ? 5 : null,
            }}
          />
        );
        expect(screen.getByText(badgeTexts[i])).toBeTruthy();
        unmount();
      }
    });

    it("passes date fields to PaymentInfoSection for rendering", () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );
      // Dates are formatted as "MMM d, yyyy" by PaymentInfoSection
      const feb5Elements = screen.getAllByText("Feb 5, 2026");
      expect(feb5Elements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Feb 28, 2026")).toBeTruthy();
      expect(screen.getByText("Mar 1, 2026")).toBeTruthy();
    });

    it("passes recentPayments for rendering payment rows", () => {
      const payments = [
        {
          id: "p-1",
          amount: 2000,
          paidAt: "2026-02-05T10:00:00.000Z",
          periodStart: "2026-02-01T00:00:00.000Z",
          periodEnd: "2026-02-28T00:00:00.000Z",
        },
        {
          id: "p-2",
          amount: 1800,
          paidAt: "2026-01-05T10:00:00.000Z",
          periodStart: "2026-01-01T00:00:00.000Z",
          periodEnd: "2026-01-31T00:00:00.000Z",
        },
      ];

      render(
        <ProfileClient
          user={defaultUser}
          paymentInfo={{
            ...defaultPaymentInfo,
            recentPayments: payments,
            totalPaymentCount: 2,
          }}
        />
      );
      expect(screen.getByText(fmtCurrency(2000))).toBeTruthy();
      expect(screen.getByText(fmtCurrency(1800))).toBeTruthy();
    });
  });

  // ===== Empty States =====

  describe("empty states", () => {
    it("shows 'No payments recorded yet' when no payments and no dates", () => {
      render(
        <ProfileClient
          user={defaultUser}
          paymentInfo={{
            ...emptyPaymentInfo,
            status: "PAID" as const,
            daysRemaining: null,
          }}
        />
      );
      expect(screen.getByText("No payments recorded yet")).toBeTruthy();
    });

    it("TRIAL user with no payments: shows empty message and trial end date", () => {
      render(
        <ProfileClient
          user={trialUser}
          paymentInfo={emptyPaymentInfo}
        />
      );
      expect(screen.getByText("No payments recorded yet")).toBeTruthy();
      expect(screen.getByText("Trial ends on Mar 15, 2026")).toBeTruthy();
    });

    it("ACTIVE user with no payments: shows empty message but no trial end date", () => {
      render(
        <ProfileClient
          user={defaultUser}
          paymentInfo={{
            ...emptyPaymentInfo,
            status: "PAID" as const,
            daysRemaining: null,
          }}
        />
      );
      expect(screen.getByText("No payments recorded yet")).toBeTruthy();
      expect(screen.queryByText(/Trial ends on/)).toBeNull();
    });

    it("does not show date grid when all dates are null", () => {
      render(
        <ProfileClient
          user={defaultUser}
          paymentInfo={{
            ...emptyPaymentInfo,
            status: "PAID" as const,
            daysRemaining: null,
          }}
        />
      );
      expect(screen.queryByText("Last payment")).toBeNull();
      expect(screen.queryByText("Paid through")).toBeNull();
      expect(screen.queryByText("Next payment due")).toBeNull();
    });
  });

  // ===== Show All Toggle =====

  describe("show all toggle", () => {
    it("shows 'Show all payments' when totalPaymentCount > recentPayments.length", () => {
      render(
        <ProfileClient
          user={defaultUser}
          paymentInfo={{
            ...defaultPaymentInfo,
            totalPaymentCount: 10,
          }}
        />
      );
      expect(screen.getByText("Show all payments")).toBeTruthy();
    });

    it("does not show toggle when counts match", () => {
      render(
        <ProfileClient
          user={defaultUser}
          paymentInfo={{
            ...defaultPaymentInfo,
            totalPaymentCount: 1,
          }}
        />
      );
      expect(screen.queryByText("Show all payments")).toBeNull();
      expect(screen.queryByText("Show recent")).toBeNull();
    });

    it("fetches all payments and toggles to 'Show recent' on click", async () => {
      const allPayments = [
        {
          id: "p-1",
          amount: 1500,
          paidAt: "2026-02-05T10:00:00.000Z",
          periodStart: "2026-02-01T00:00:00.000Z",
          periodEnd: "2026-02-28T00:00:00.000Z",
        },
        {
          id: "p-2",
          amount: 1200,
          paidAt: "2026-01-05T10:00:00.000Z",
          periodStart: "2026-01-01T00:00:00.000Z",
          periodEnd: "2026-01-31T00:00:00.000Z",
        },
        {
          id: "p-3",
          amount: 1000,
          paidAt: "2025-12-05T10:00:00.000Z",
          periodStart: "2025-12-01T00:00:00.000Z",
          periodEnd: "2025-12-31T00:00:00.000Z",
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: allPayments }),
      });

      render(
        <ProfileClient
          user={defaultUser}
          paymentInfo={{
            ...defaultPaymentInfo,
            totalPaymentCount: 3,
          }}
        />
      );

      fireEvent.click(screen.getByText("Show all payments"));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/payments/my");
      });

      await waitFor(() => {
        screen.getByText("Show recent");
      });

      // The third payment should now be visible
      expect(screen.getByText(fmtCurrency(1000))).toBeTruthy();
    });

    it("does not show toggle when no payments exist", () => {
      render(
        <ProfileClient user={trialUser} paymentInfo={emptyPaymentInfo} />
      );
      expect(screen.queryByText("Show all payments")).toBeNull();
    });
  });

  // ===== Profile Form Coexistence =====

  describe("profile form and payment section coexistence", () => {
    it("renders both profile form and payment section together", () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );

      // Profile heading
      expect(screen.getByText("My Profile")).toBeTruthy();

      // Profile info card
      expect(screen.getByText("Profile Information")).toBeTruthy();

      // Form inputs
      expect(screen.getByLabelText("Full Name")).toBeTruthy();
      expect(screen.getByLabelText("Email")).toBeTruthy();
      expect(screen.getByLabelText("Phone (optional)")).toBeTruthy();

      // Payment section
      expect(screen.getByText("Payment Information")).toBeTruthy();

      // Password section (header + button share text)
      expect(
        screen.getAllByText("Change Password").length
      ).toBeGreaterThanOrEqual(1);

      // Danger zone
      expect(screen.getByText("Danger Zone")).toBeTruthy();
    });

    it("renders user avatar initial when no photo", () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );
      expect(screen.getByText("J")).toBeTruthy();
    });

    it("renders user photo when photo URL provided", () => {
      const userWithPhoto = {
        ...defaultUser,
        photo: "https://example.com/photo.jpg",
      };
      render(
        <ProfileClient
          user={userWithPhoto}
          paymentInfo={defaultPaymentInfo}
        />
      );
      const img = screen.getByAltText("Jane Doe");
      expect(img).toBeTruthy();
      expect(img.getAttribute("src")).toBe("https://example.com/photo.jpg");
    });

    it("renders member status badge - New Member for TRIAL user", () => {
      render(
        <ProfileClient
          user={trialUser}
          paymentInfo={{
            ...defaultPaymentInfo,
            status: "GRACE_PERIOD" as const,
            daysRemaining: 14,
          }}
        />
      );
      expect(screen.getByText("New Member")).toBeTruthy();
    });

    it("renders member status badge - ACTIVE for active user", () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );
      expect(screen.getByText("ACTIVE")).toBeTruthy();
    });

    it("renders member since date", () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );
      // format(new Date("2025-12-01"), "MMMM yyyy") = "December 2025"
      expect(screen.getByText("Member since December 2025")).toBeTruthy();
    });

    it("renders Save Changes button", () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );
      expect(
        screen.getByRole("button", { name: "Save Changes" })
      ).toBeTruthy();
    });

    it("renders Stop Training link in danger zone", () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );
      const stopTrainingButton = screen.getByRole("button", {
        name: "Stop Training",
      });
      expect(stopTrainingButton).toBeTruthy();
      // The button is wrapped in a Link to /member/stop-training
      const link = stopTrainingButton.closest("a");
      expect(link?.getAttribute("href")).toBe("/member/stop-training");
    });

    it("renders password form inputs", () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );
      expect(screen.getByLabelText("Current Password")).toBeTruthy();
      expect(screen.getByLabelText("New Password")).toBeTruthy();
      expect(screen.getByLabelText("Confirm New Password")).toBeTruthy();
    });

    it("renders depart description text", () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );
      expect(
        screen.getByText(
          "This will mark your account as departed. You can request to rejoin later."
        )
      ).toBeTruthy();
    });
  });

  // ===== Profile Form Interactions =====

  describe("profile form interactions", () => {
    it("submits PATCH request with form data on save", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );

      // Change name
      fireEvent.change(screen.getByLabelText("Full Name"), {
        target: { value: "Jane Smith" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(`/api/members/${defaultUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Jane Smith",
            email: "jane@example.com",
            phone: "+38970123456",
          }),
        });
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "success",
          title: "Profile updated",
        });
      });

      expect(mockRefresh).toHaveBeenCalled();
    });

    it("shows validation error for empty name", async () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );

      // Clear name
      fireEvent.change(screen.getByLabelText("Full Name"), {
        target: { value: "" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

      await waitFor(() => {
        expect(screen.getByText("Name is required")).toBeTruthy();
      });

      // Should NOT have called fetch
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("shows validation error for empty email", async () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );

      // Clear email
      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

      await waitFor(() => {
        expect(screen.getByText("Email is required")).toBeTruthy();
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("shows validation error for invalid email format", async () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );

      // Use a value that passes HTML5 type="email" validation in jsdom
      // but fails the component's regex (which requires a dot in the domain)
      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "user@localhost" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

      await waitFor(() => {
        expect(screen.getByText("Invalid email format")).toBeTruthy();
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("shows error toast when save fails with API error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Email already taken" }),
      });

      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );

      fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "error",
          title: "Failed to update",
          message: "Email already taken",
        });
      });
    });

    it("shows network error toast when save throws", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );

      fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "error",
          title: "Network error",
        });
      });
    });

    it("sends null phone when phone field is empty", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const userNoPhone = { ...defaultUser, phone: null };

      render(
        <ProfileClient user={userNoPhone} paymentInfo={defaultPaymentInfo} />
      );

      fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/api/members/${defaultUser.id}`,
          expect.objectContaining({
            body: JSON.stringify({
              name: "Jane Doe",
              email: "jane@example.com",
              phone: null,
            }),
          })
        );
      });
    });
  });

  // ===== Password Change Form =====

  describe("password change form", () => {
    it("submits POST request with passwords on change", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );

      fireEvent.change(screen.getByLabelText("Current Password"), {
        target: { value: "oldpassword1" },
      });
      fireEvent.change(screen.getByLabelText("New Password"), {
        target: { value: "newpassword1" },
      });
      fireEvent.change(screen.getByLabelText("Confirm New Password"), {
        target: { value: "newpassword1" },
      });

      // Find the Change Password button (the submit button, not the card header)
      const buttons = screen.getAllByRole("button", {
        name: "Change Password",
      });
      // The submit button is the one inside the form
      fireEvent.click(buttons[buttons.length - 1]);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/auth/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentPassword: "oldpassword1",
            newPassword: "newpassword1",
          }),
        });
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "success",
          title: "Password changed",
        });
      });
    });

    it("shows validation error when current password is empty", async () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );

      fireEvent.change(screen.getByLabelText("New Password"), {
        target: { value: "newpassword1" },
      });
      fireEvent.change(screen.getByLabelText("Confirm New Password"), {
        target: { value: "newpassword1" },
      });

      const buttons = screen.getAllByRole("button", {
        name: "Change Password",
      });
      fireEvent.click(buttons[buttons.length - 1]);

      await waitFor(() => {
        expect(screen.getByText("Current password required")).toBeTruthy();
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("shows validation error when new password is too short", async () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );

      fireEvent.change(screen.getByLabelText("Current Password"), {
        target: { value: "oldpassword1" },
      });
      fireEvent.change(screen.getByLabelText("New Password"), {
        target: { value: "short" },
      });
      fireEvent.change(screen.getByLabelText("Confirm New Password"), {
        target: { value: "short" },
      });

      const buttons = screen.getAllByRole("button", {
        name: "Change Password",
      });
      fireEvent.click(buttons[buttons.length - 1]);

      await waitFor(() => {
        expect(
          screen.getByText("Password must be at least 8 characters")
        ).toBeTruthy();
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("shows validation error when passwords do not match", async () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );

      fireEvent.change(screen.getByLabelText("Current Password"), {
        target: { value: "oldpassword1" },
      });
      fireEvent.change(screen.getByLabelText("New Password"), {
        target: { value: "newpassword1" },
      });
      fireEvent.change(screen.getByLabelText("Confirm New Password"), {
        target: { value: "differentpassword" },
      });

      const buttons = screen.getAllByRole("button", {
        name: "Change Password",
      });
      fireEvent.click(buttons[buttons.length - 1]);

      await waitFor(() => {
        expect(screen.getByText("Passwords do not match")).toBeTruthy();
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("shows validation error when new password is empty (min length check)", async () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );

      fireEvent.change(screen.getByLabelText("Current Password"), {
        target: { value: "oldpassword1" },
      });

      const buttons = screen.getAllByRole("button", {
        name: "Change Password",
      });
      fireEvent.click(buttons[buttons.length - 1]);

      // Empty string also fails the length < 8 check, which overwrites the "required" error
      await waitFor(() => {
        expect(
          screen.getByText("Password must be at least 8 characters")
        ).toBeTruthy();
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("shows form-level error when API returns error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Current password is incorrect" }),
      });

      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );

      fireEvent.change(screen.getByLabelText("Current Password"), {
        target: { value: "wrongpassword" },
      });
      fireEvent.change(screen.getByLabelText("New Password"), {
        target: { value: "newpassword1" },
      });
      fireEvent.change(screen.getByLabelText("Confirm New Password"), {
        target: { value: "newpassword1" },
      });

      const buttons = screen.getAllByRole("button", {
        name: "Change Password",
      });
      fireEvent.click(buttons[buttons.length - 1]);

      await waitFor(() => {
        expect(
          screen.getByText("Current password is incorrect")
        ).toBeTruthy();
      });
    });

    it("shows network error toast when password change throws", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );

      fireEvent.change(screen.getByLabelText("Current Password"), {
        target: { value: "oldpassword1" },
      });
      fireEvent.change(screen.getByLabelText("New Password"), {
        target: { value: "newpassword1" },
      });
      fireEvent.change(screen.getByLabelText("Confirm New Password"), {
        target: { value: "newpassword1" },
      });

      const buttons = screen.getAllByRole("button", {
        name: "Change Password",
      });
      fireEvent.click(buttons[buttons.length - 1]);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "error",
          title: "Network error",
        });
      });
    });

    it("clears password fields after successful change", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );

      const currentPwInput = screen.getByLabelText(
        "Current Password"
      ) as HTMLInputElement;
      const newPwInput = screen.getByLabelText(
        "New Password"
      ) as HTMLInputElement;
      const confirmPwInput = screen.getByLabelText(
        "Confirm New Password"
      ) as HTMLInputElement;

      fireEvent.change(currentPwInput, { target: { value: "oldpassword1" } });
      fireEvent.change(newPwInput, { target: { value: "newpassword1" } });
      fireEvent.change(confirmPwInput, { target: { value: "newpassword1" } });

      const buttons = screen.getAllByRole("button", {
        name: "Change Password",
      });
      fireEvent.click(buttons[buttons.length - 1]);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "success",
          title: "Password changed",
        });
      });

      expect(currentPwInput.value).toBe("");
      expect(newPwInput.value).toBe("");
      expect(confirmPwInput.value).toBe("");
    });

    it("renders help text for new password field", () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );
      expect(screen.getByText("At least 8 characters")).toBeTruthy();
    });
  });

  // ===== Edge Cases =====

  describe("edge cases", () => {
    it("renders without breaking with a very long name", () => {
      const longNameUser = {
        ...defaultUser,
        name: "Alexandrina Bartholomew Christopherson-Fitzwilliam the Third of Canterbury",
      };

      render(
        <ProfileClient
          user={longNameUser}
          paymentInfo={defaultPaymentInfo}
        />
      );

      // Should render the initial
      expect(screen.getByText("A")).toBeTruthy();
      // The full name should appear in the input
      const nameInput = screen.getByLabelText("Full Name") as HTMLInputElement;
      expect(nameInput.value).toBe(longNameUser.name);
    });

    it("handles all null optional fields (phone, photo, trialEndsAt)", () => {
      const minimalUser = {
        ...defaultUser,
        phone: null,
        photo: null,
        trialEndsAt: null,
      };

      render(
        <ProfileClient user={minimalUser} paymentInfo={defaultPaymentInfo} />
      );

      // Should render avatar initial instead of photo
      expect(screen.getByText("J")).toBeTruthy();
      // Phone field should be empty
      const phoneInput = screen.getByLabelText(
        "Phone (optional)"
      ) as HTMLInputElement;
      expect(phoneInput.value).toBe("");
    });

    it("DEPARTED user: shows Departed status in both profile and payment sections", () => {
      render(
        <ProfileClient
          user={departedUser}
          paymentInfo={{
            ...defaultPaymentInfo,
            status: "DEPARTED" as const,
          }}
        />
      );

      // Profile section shows status badge
      expect(screen.getByText("DEPARTED")).toBeTruthy();
      // Payment section shows departed badge via PaymentStatusBadge
      expect(screen.getByText("Departed")).toBeTruthy();
    });

    it("pre-fills form inputs with user data", () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );

      const nameInput = screen.getByLabelText("Full Name") as HTMLInputElement;
      const emailInput = screen.getByLabelText("Email") as HTMLInputElement;
      const phoneInput = screen.getByLabelText(
        "Phone (optional)"
      ) as HTMLInputElement;

      expect(nameInput.value).toBe("Jane Doe");
      expect(emailInput.value).toBe("jane@example.com");
      expect(phoneInput.value).toBe("+38970123456");
    });

    it("renders date columns conditionally based on available dates", () => {
      // Only lastPaymentDate provided
      render(
        <ProfileClient
          user={defaultUser}
          paymentInfo={{
            ...defaultPaymentInfo,
            paidThroughDate: null,
            nextPaymentDue: null,
          }}
        />
      );

      expect(screen.getByText("Last payment")).toBeTruthy();
      expect(screen.queryByText("Paid through")).toBeNull();
      expect(screen.queryByText("Next payment due")).toBeNull();
    });

    it("renders irreversible actions description in danger zone", () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );
      expect(screen.getByText("Irreversible actions")).toBeTruthy();
    });

    it("GRACE_PERIOD with null daysRemaining does not show alert", () => {
      render(
        <ProfileClient
          user={defaultUser}
          paymentInfo={{
            ...defaultPaymentInfo,
            status: "GRACE_PERIOD" as const,
            daysRemaining: null,
          }}
        />
      );

      expect(screen.getByText("Grace Period")).toBeTruthy();
      // The warning alert only shows when daysRemaining is not null
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});
