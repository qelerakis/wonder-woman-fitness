/**
 * ProfileClient Unit Tests
 *
 * Tests that ProfileClient renders the payment information section,
 * coexists with the profile form and password sections,
 * and passes correct props to PaymentInfoSection.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ===== Mocks =====

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
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

// ===== Test Data =====

const defaultUser = {
  id: "user-1",
  name: "Jane Doe",
  email: "jane@example.com",
  phone: "+38970123456",
  photo: null as string | null,
  status: "ACTIVE" as const,
  joinDate: "2025-12-01T00:00:00.000Z",
  trialEndsAt: null as string | null,
};

const defaultPaymentInfo = {
  status: "PAID" as const,
  daysRemaining: null,
  lastPaymentDate: "2026-02-05T10:00:00.000Z",
  paidThroughDate: "2026-02-28T00:00:00.000Z",
  nextPaymentDue: "2026-03-01T00:00:00.000Z",
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

// ===== Tests =====

describe("ProfileClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ----- Payment Information Section -----

  describe("payment information section", () => {
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

    it("renders grace period warning for GRACE_PERIOD status", () => {
      render(
        <ProfileClient
          user={defaultUser}
          paymentInfo={{
            ...defaultPaymentInfo,
            status: "GRACE_PERIOD",
            daysRemaining: 5,
          }}
        />
      );
      expect(screen.getByText("Grace Period")).toBeTruthy();
      expect(screen.getByText("5 days remaining to pay")).toBeTruthy();
    });

    it("renders locked alert for LOCKED status", () => {
      render(
        <ProfileClient
          user={defaultUser}
          paymentInfo={{
            ...defaultPaymentInfo,
            status: "LOCKED",
            daysRemaining: 0,
          }}
        />
      );
      expect(screen.getByText("Locked")).toBeTruthy();
    });

    it("renders recent payment amounts", () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );
      // Amount is formatted via toLocaleString() + " MKD"
      const amountText = `${(1500).toLocaleString()} MKD`;
      expect(screen.getByText(amountText)).toBeTruthy();
    });

    it("renders date info grid items", () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );
      expect(screen.getByText("Last payment")).toBeTruthy();
      expect(screen.getByText("Paid through")).toBeTruthy();
      expect(screen.getByText("Next payment due")).toBeTruthy();
    });

    it("renders trial info for trial member with no payments", () => {
      const trialUser = {
        ...defaultUser,
        status: "TRIAL" as const,
        trialEndsAt: "2026-03-15T00:00:00.000Z",
      };

      render(
        <ProfileClient
          user={trialUser}
          paymentInfo={{
            ...defaultPaymentInfo,
            status: "GRACE_PERIOD",
            daysRemaining: 14,
            lastPaymentDate: null,
            paidThroughDate: null,
            nextPaymentDue: null,
            recentPayments: [],
            totalPaymentCount: 0,
          }}
        />
      );

      expect(screen.getByText("No payments recorded yet")).toBeTruthy();
      expect(screen.getByText("Trial ends on Mar 15, 2026")).toBeTruthy();
    });
  });

  // ----- Coexistence with profile form -----

  describe("profile form and payment section coexistence", () => {
    it("renders both profile form and payment section together", () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );

      // Profile form elements
      expect(screen.getByText("My Profile")).toBeTruthy();
      expect(screen.getByText("Profile Information")).toBeTruthy();
      expect(screen.getByLabelText("Full Name")).toBeTruthy();
      expect(screen.getByLabelText("Email")).toBeTruthy();

      // Payment section
      expect(screen.getByText("Payment Information")).toBeTruthy();

      // Password section (heading + button both say "Change Password")
      expect(screen.getAllByText("Change Password").length).toBeGreaterThanOrEqual(1);

      // Danger zone
      expect(screen.getByText("Danger Zone")).toBeTruthy();
    });

    it("renders user avatar initial when no photo", () => {
      render(
        <ProfileClient user={defaultUser} paymentInfo={defaultPaymentInfo} />
      );
      expect(screen.getByText("J")).toBeTruthy();
    });

    it("renders user photo when provided", () => {
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
  });

  // ----- Props passing -----

  describe("props passing to PaymentInfoSection", () => {
    it("passes override status correctly", () => {
      render(
        <ProfileClient
          user={defaultUser}
          paymentInfo={{
            ...defaultPaymentInfo,
            status: "OVERRIDE",
          }}
        />
      );
      expect(screen.getByText("Override")).toBeTruthy();
      expect(screen.getByText("Payment override active")).toBeTruthy();
    });

    it("passes trial user status correctly for trial countdown", () => {
      const trialUser = {
        ...defaultUser,
        status: "TRIAL" as const,
        trialEndsAt: "2026-03-10T00:00:00.000Z",
      };

      render(
        <ProfileClient
          user={trialUser}
          paymentInfo={{
            ...defaultPaymentInfo,
            status: "GRACE_PERIOD",
            daysRemaining: 10,
          }}
        />
      );

      // Trial member shows "remaining in trial" instead of "remaining to pay"
      expect(screen.getByText("10 days remaining in trial")).toBeTruthy();
    });

    it("shows 'Show all payments' when totalPaymentCount exceeds recentPayments length", () => {
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

    it("does not show 'Show all payments' when all payments are visible", () => {
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
    });
  });
});
