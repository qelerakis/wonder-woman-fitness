/**
 * NotificationsClient Unit Tests (Owner-specific features)
 *
 * Tests the Send Notification button visibility, modal integration,
 * and backward compatibility with the isOwner/recurringSlots props.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ===== Mocks =====

// Mock next/navigation
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

// Mock useToast
const mockAddToast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

// Mock SendNotificationModal to avoid its internal fetch calls
const mockSendNotificationModal = vi.fn();
vi.mock("@/components/notification/SendNotificationModal", () => ({
  SendNotificationModal: (props: Record<string, unknown>) => {
    mockSendNotificationModal(props);
    if (!props.isOpen) return null;
    return (
      <div data-testid="send-notification-modal">
        <span>Mocked SendNotificationModal</span>
      </div>
    );
  },
}));

// Mock fetch globally (for mark-as-read calls)
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ===== Test Data =====

const sampleNotifications = [
  {
    id: "n-1",
    type: "PAYMENT_REMINDER",
    title: "Payment reminder",
    body: "Your payment is due soon",
    read: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "n-2",
    type: "WORKOUT_POSTED",
    title: "Workout posted",
    body: "New workout for Monday",
    read: true,
    createdAt: new Date().toISOString(),
  },
];

const sampleSlots = [
  { id: "slot-1", dayOfWeek: 1, startHour: 9 },
  { id: "slot-2", dayOfWeek: 3, startHour: 18 },
];

const defaultProps = {
  notifications: sampleNotifications,
  unreadCount: 1,
};

// ===== Tests =====

describe("NotificationsClient (Owner features)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================
  // Send Notification Button Visibility
  // ========================

  describe("Send Notification button visibility", () => {
    it("does NOT show 'Send Notification' button when isOwner is false", async () => {
      const { NotificationsClient } = await import(
        "@/components/notification/NotificationsClient"
      );

      render(<NotificationsClient {...defaultProps} isOwner={false} />);

      expect(
        screen.queryByRole("button", { name: "Send Notification" })
      ).toBeNull();
    });

    it("does NOT show 'Send Notification' button when isOwner is undefined", async () => {
      const { NotificationsClient } = await import(
        "@/components/notification/NotificationsClient"
      );

      render(<NotificationsClient {...defaultProps} />);

      expect(
        screen.queryByRole("button", { name: "Send Notification" })
      ).toBeNull();
    });

    it("shows 'Send Notification' button when isOwner is true", async () => {
      const { NotificationsClient } = await import(
        "@/components/notification/NotificationsClient"
      );

      render(
        <NotificationsClient
          {...defaultProps}
          isOwner={true}
          recurringSlots={sampleSlots}
        />
      );

      expect(
        screen.getByRole("button", { name: "Send Notification" })
      ).toBeTruthy();
    });

    it("Send Notification button has variant='primary' (uses primary class)", async () => {
      const { NotificationsClient } = await import(
        "@/components/notification/NotificationsClient"
      );

      render(
        <NotificationsClient
          {...defaultProps}
          isOwner={true}
          recurringSlots={sampleSlots}
        />
      );

      const sendButton = screen.getByRole("button", { name: "Send Notification" });
      // The Button component with variant="primary" applies bg-primary-600
      expect(sendButton.className).toContain("bg-primary");
    });
  });

  // ========================
  // Modal Integration
  // ========================

  describe("Modal integration", () => {
    it("clicking 'Send Notification' opens the SendNotificationModal", async () => {
      const { NotificationsClient } = await import(
        "@/components/notification/NotificationsClient"
      );

      render(
        <NotificationsClient
          {...defaultProps}
          isOwner={true}
          recurringSlots={sampleSlots}
        />
      );

      // Modal should not be visible initially
      expect(screen.queryByTestId("send-notification-modal")).toBeNull();

      const sendButton = screen.getByRole("button", { name: "Send Notification" });
      fireEvent.click(sendButton);

      // Modal should now be visible
      expect(screen.getByTestId("send-notification-modal")).toBeTruthy();
      expect(screen.getByText("Mocked SendNotificationModal")).toBeTruthy();
    });

    it("modal receives recurringSlots prop", async () => {
      const { NotificationsClient } = await import(
        "@/components/notification/NotificationsClient"
      );

      render(
        <NotificationsClient
          {...defaultProps}
          isOwner={true}
          recurringSlots={sampleSlots}
        />
      );

      // The SendNotificationModal is rendered by isOwner=true
      // Find the call that passed the recurringSlots
      expect(mockSendNotificationModal).toHaveBeenCalledWith(
        expect.objectContaining({
          recurringSlots: sampleSlots,
        })
      );
    });

    it("modal is not rendered at all when isOwner is false", async () => {
      const { NotificationsClient } = await import(
        "@/components/notification/NotificationsClient"
      );

      render(<NotificationsClient {...defaultProps} isOwner={false} />);

      // SendNotificationModal should not have been called
      expect(mockSendNotificationModal).not.toHaveBeenCalled();
    });
  });

  // ========================
  // Backward Compatibility
  // ========================

  describe("Backward compatibility", () => {
    it("works with no isOwner or recurringSlots props (defaults)", async () => {
      const { NotificationsClient } = await import(
        "@/components/notification/NotificationsClient"
      );

      // Should not throw
      render(<NotificationsClient {...defaultProps} />);

      // Should still render notification list
      expect(screen.getByText("Payment reminder")).toBeTruthy();
      expect(screen.getByText("Workout posted")).toBeTruthy();
    });

    it("still renders notifications list normally with isOwner=true", async () => {
      const { NotificationsClient } = await import(
        "@/components/notification/NotificationsClient"
      );

      render(
        <NotificationsClient
          {...defaultProps}
          isOwner={true}
          recurringSlots={sampleSlots}
        />
      );

      // Notifications should render
      expect(screen.getByText("Payment reminder")).toBeTruthy();
      expect(screen.getByText("Workout posted")).toBeTruthy();
      expect(screen.getByText("Notifications")).toBeTruthy();
    });

    it("renders filter buttons (All, Unread) regardless of isOwner", async () => {
      const { NotificationsClient } = await import(
        "@/components/notification/NotificationsClient"
      );

      render(
        <NotificationsClient
          {...defaultProps}
          isOwner={true}
          recurringSlots={sampleSlots}
        />
      );

      expect(screen.getByRole("button", { name: /^All/ })).toBeTruthy();
      expect(screen.getByRole("button", { name: /^Unread/ })).toBeTruthy();
    });

    it("renders 'Mark all read' button when there are unread notifications", async () => {
      const { NotificationsClient } = await import(
        "@/components/notification/NotificationsClient"
      );

      render(
        <NotificationsClient
          {...defaultProps}
          isOwner={true}
          recurringSlots={sampleSlots}
        />
      );

      expect(
        screen.getByRole("button", { name: "Mark all read" })
      ).toBeTruthy();
    });

    it("shows unread count in header", async () => {
      const { NotificationsClient } = await import(
        "@/components/notification/NotificationsClient"
      );

      render(
        <NotificationsClient
          {...defaultProps}
          isOwner={true}
          recurringSlots={sampleSlots}
        />
      );

      expect(screen.getByText("1 unread notification")).toBeTruthy();
    });
  });
});
