/**
 * SendNotificationModal Unit Tests
 *
 * Tests rendering, audience selection, conditional UI, recipient counting,
 * form validation, confirmation flow, send success/failure, and form reset.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";

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

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ===== Helpers =====

function mockRecipientsResponse(
  count: number,
  members: { id: string; name: string }[] = []
): { ok: true; json: () => Promise<{ data: { count: number; members: { id: string; name: string }[] } }> } {
  return {
    ok: true,
    json: () => Promise.resolve({ data: { count, members } }),
  };
}

function mockSendResponse(sentCount: number): {
  ok: true;
  json: () => Promise<{ data: { sentCount: number } }>;
} {
  return {
    ok: true,
    json: () => Promise.resolve({ data: { sentCount } }),
  };
}

function mockErrorResponse(
  error: string,
  status = 400
): { ok: false; status: number; json: () => Promise<{ error: string }> } {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error }),
  };
}

const sampleSlots = [
  { id: "slot-1", dayOfWeek: 1, startHour: 9 },
  { id: "slot-2", dayOfWeek: 3, startHour: 18 },
];

const sampleMembers = [
  { id: "m-1", name: "Alice Johnson" },
  { id: "m-2", name: "Bob Smith" },
  { id: "m-3", name: "Charlie Brown" },
];

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  recurringSlots: sampleSlots,
};

/**
 * Render helper that wraps render() in act() so the component's initial
 * useEffect (fetchRecipients) settles before assertions run.
 * This eliminates React act() warnings caused by state updates from the
 * async fetch inside useEffect.
 */
async function renderModal(
  props: Partial<typeof defaultProps> = {}
): Promise<ReturnType<typeof render>> {
  const mod = await import("@/components/notification/SendNotificationModal");
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<mod.SendNotificationModal {...defaultProps} {...props} />);
  });
  return result!;
}

// ===== Tests =====

describe("SendNotificationModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return 5 recipients for non-INDIVIDUAL audience
    mockFetch.mockResolvedValue(mockRecipientsResponse(5));
  });

  // ========================
  // Rendering
  // ========================

  describe("Rendering", () => {
    it("does not render when isOpen is false", async () => {
      const { container } = await renderModal({ isOpen: false });

      expect(container.innerHTML).toBe("");
    });

    it("renders modal title 'Send Notification' when open", async () => {
      await renderModal();

      // The heading contains "Send Notification" (not the button)
      const heading = screen.getByRole("heading", { name: "Send Notification" });
      expect(heading).toBeTruthy();
    });

    it("renders all 5 audience radio options", async () => {
      await renderModal();

      expect(screen.getByText("All active members")).toBeTruthy();
      expect(screen.getByText("Trial members only")).toBeTruthy();
      expect(screen.getByText("Members from a session slot")).toBeTruthy();
      expect(screen.getByText("Members by payment status")).toBeTruthy();
      expect(screen.getByText("Select specific members")).toBeTruthy();
    });

    it("default audience is 'All active members' (ALL)", async () => {
      await renderModal();

      const radios = screen.getAllByRole("radio");
      // First radio = ALL
      expect((radios[0] as HTMLInputElement).checked).toBe(true);
      expect((radios[0] as HTMLInputElement).value).toBe("ALL");
    });

    it("renders title input with placeholder", async () => {
      await renderModal();

      expect(
        screen.getByPlaceholderText("e.g., Studio closed this Friday")
      ).toBeTruthy();
    });

    it("renders body textarea with placeholder", async () => {
      await renderModal();

      expect(
        screen.getByPlaceholderText("Write your message here...")
      ).toBeTruthy();
    });

    it("renders Send Notification button", async () => {
      await renderModal();

      expect(
        screen.getByRole("button", { name: "Send Notification" })
      ).toBeTruthy();
    });

    it("renders Cancel button", async () => {
      await renderModal();

      expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
    });

    it("shows character counters for title (0/100) and body (0/500)", async () => {
      await renderModal();

      expect(screen.getByText("0/100")).toBeTruthy();
      expect(screen.getByText("0/500")).toBeTruthy();
    });

    it("renders Audience label", async () => {
      await renderModal();

      expect(screen.getByText("Audience")).toBeTruthy();
    });

    it("renders Title label", async () => {
      await renderModal();

      expect(screen.getByText("Title")).toBeTruthy();
    });

    it("renders Message label", async () => {
      await renderModal();

      expect(screen.getByText("Message")).toBeTruthy();
    });
  });

  // ========================
  // Audience Selection
  // ========================

  describe("Audience selection", () => {
    it("clicking each radio changes the selected audience", async () => {
      await renderModal();

      const radios = screen.getAllByRole("radio");

      // Click TRIAL
      await act(async () => {
        fireEvent.click(radios[1]);
      });
      expect((radios[1] as HTMLInputElement).checked).toBe(true);
      expect((radios[0] as HTMLInputElement).checked).toBe(false);

      // Click SESSION_SLOT
      await act(async () => {
        fireEvent.click(radios[2]);
      });
      expect((radios[2] as HTMLInputElement).checked).toBe(true);
      expect((radios[1] as HTMLInputElement).checked).toBe(false);

      // Click PAYMENT_STATUS
      await act(async () => {
        fireEvent.click(radios[3]);
      });
      expect((radios[3] as HTMLInputElement).checked).toBe(true);
      expect((radios[2] as HTMLInputElement).checked).toBe(false);

      // Click INDIVIDUAL
      await act(async () => {
        fireEvent.click(radios[4]);
      });
      expect((radios[4] as HTMLInputElement).checked).toBe(true);
      expect((radios[3] as HTMLInputElement).checked).toBe(false);
    });

    it("SESSION_SLOT shows slot dropdown when selected", async () => {
      await renderModal();

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[2]); // SESSION_SLOT
      });

      expect(screen.getByText("Session Slot")).toBeTruthy();
      expect(screen.getByText("Select a slot...")).toBeTruthy();
    });

    it("SESSION_SLOT does NOT show slot dropdown when not selected", async () => {
      await renderModal();

      // Default is ALL - no slot dropdown
      expect(screen.queryByText("Session Slot")).toBeNull();
      expect(screen.queryByText("Select a slot...")).toBeNull();
    });

    it("PAYMENT_STATUS shows payment status dropdown when selected", async () => {
      await renderModal();

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[3]); // PAYMENT_STATUS
      });

      expect(screen.getByText("Payment Status")).toBeTruthy();
      expect(screen.getByText("Grace Period")).toBeTruthy();
      expect(screen.getByText("Locked")).toBeTruthy();
    });

    it("INDIVIDUAL shows member search and checkbox list when selected", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(3, sampleMembers));

      await renderModal();

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[4]); // INDIVIDUAL
      });

      expect(screen.getByText("Select Members")).toBeTruthy();
      expect(
        screen.getByPlaceholderText("Search members...")
      ).toBeTruthy();
    });

    it("switching back to ALL hides conditional UI", async () => {
      await renderModal();

      const radios = screen.getAllByRole("radio");

      // Select SESSION_SLOT
      await act(async () => {
        fireEvent.click(radios[2]);
      });
      expect(screen.getByText("Session Slot")).toBeTruthy();

      // Switch back to ALL
      await act(async () => {
        fireEvent.click(radios[0]);
      });
      expect(screen.queryByText("Session Slot")).toBeNull();
    });

    it("PAYMENT_STATUS dropdown is hidden when ALL is selected", async () => {
      await renderModal();

      expect(screen.queryByText("Payment Status")).toBeNull();
    });

    it("INDIVIDUAL member picker is hidden when ALL is selected", async () => {
      await renderModal();

      expect(screen.queryByText("Select Members")).toBeNull();
    });
  });

  // ========================
  // Session Slot Picker
  // ========================

  describe("Session slot picker", () => {
    it("renders 'Select a slot...' default option", async () => {
      await renderModal();

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[2]); // SESSION_SLOT
      });

      expect(screen.getByText("Select a slot...")).toBeTruthy();
    });

    it("renders all provided slots with correct labels", async () => {
      await renderModal();

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[2]); // SESSION_SLOT
      });

      // dayOfWeek 1 = Monday, startHour 9 = 09:00
      expect(screen.getByText("Monday 09:00")).toBeTruthy();
      // dayOfWeek 3 = Wednesday, startHour 18 = 18:00
      expect(screen.getByText("Wednesday 18:00")).toBeTruthy();
    });

    it("changing slot triggers recipient fetch", async () => {
      await renderModal();

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[2]); // SESSION_SLOT
      });

      // Clear mock calls from the initial open fetch
      mockFetch.mockClear();
      mockFetch.mockResolvedValue(mockRecipientsResponse(3));

      const select = screen.getByRole("combobox");
      await act(async () => {
        fireEvent.change(select, { target: { value: "slot-1" } });
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/notifications/broadcast/recipients")
        );
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("slotId=slot-1")
        );
      });
    });
  });

  // ========================
  // Payment Status Picker
  // ========================

  describe("Payment status picker", () => {
    it("renders 'Grace Period' and 'Locked' options", async () => {
      await renderModal();

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[3]); // PAYMENT_STATUS
      });

      const options = screen.getAllByRole("option");
      const optionTexts = options.map((o) => o.textContent);
      expect(optionTexts).toContain("Grace Period");
      expect(optionTexts).toContain("Locked");
    });

    it("default is 'Grace Period'", async () => {
      await renderModal();

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[3]); // PAYMENT_STATUS
      });

      const select = screen.getByRole("combobox");
      expect((select as HTMLSelectElement).value).toBe("GRACE_PERIOD");
    });

    it("changing payment status triggers recipient fetch", async () => {
      await renderModal();

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[3]); // PAYMENT_STATUS
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValue(mockRecipientsResponse(2));

      const select = screen.getByRole("combobox");
      await act(async () => {
        fireEvent.change(select, { target: { value: "LOCKED" } });
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("paymentStatus=LOCKED")
        );
      });
    });
  });

  // ========================
  // Individual Member Picker
  // ========================

  describe("Individual member picker", () => {
    it("shows search input with 'Search members...' placeholder", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(3, sampleMembers));

      await renderModal();

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[4]); // INDIVIDUAL
      });

      expect(
        screen.getByPlaceholderText("Search members...")
      ).toBeTruthy();
    });

    it("shows 'Loading...' when loading", async () => {
      // Make fetch never resolve
      mockFetch.mockImplementation(
        () => new Promise(() => {})
      );

      await renderModal();

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[4]); // INDIVIDUAL
      });

      await waitFor(() => {
        expect(screen.getByText("Loading...")).toBeTruthy();
      });
    });

    it("shows 'No members found' when empty", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(0, []));

      await renderModal();

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[4]); // INDIVIDUAL
      });

      await waitFor(() => {
        expect(screen.getByText("No members found")).toBeTruthy();
      });
    });

    it("renders member checkboxes from API response", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(3, sampleMembers));

      await renderModal();

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[4]); // INDIVIDUAL
      });

      await waitFor(() => {
        expect(screen.getByText("Alice Johnson")).toBeTruthy();
        expect(screen.getByText("Bob Smith")).toBeTruthy();
        expect(screen.getByText("Charlie Brown")).toBeTruthy();
      });

      const checkboxes = screen.getAllByRole("checkbox");
      expect(checkboxes.length).toBe(3);
    });

    it("toggling checkbox adds/removes member from selection", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(3, sampleMembers));

      await renderModal();

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[4]); // INDIVIDUAL
      });

      await waitFor(() => {
        expect(screen.getByText("Alice Johnson")).toBeTruthy();
      });

      const checkboxes = screen.getAllByRole("checkbox");

      // Check Alice
      fireEvent.click(checkboxes[0]);
      expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
      expect(screen.getByText("1 selected")).toBeTruthy();

      // Check Bob
      fireEvent.click(checkboxes[1]);
      expect((checkboxes[1] as HTMLInputElement).checked).toBe(true);
      expect(screen.getByText("2 selected")).toBeTruthy();

      // Uncheck Alice
      fireEvent.click(checkboxes[0]);
      expect((checkboxes[0] as HTMLInputElement).checked).toBe(false);
      expect(screen.getByText("1 selected")).toBeTruthy();
    });

    it("shows 'X selected' count", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(3, sampleMembers));

      await renderModal();

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[4]); // INDIVIDUAL
      });

      await waitFor(() => {
        expect(screen.getByText("Alice Johnson")).toBeTruthy();
      });

      // No selected count initially
      expect(screen.queryByText(/selected/)).toBeNull();

      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[1]);

      expect(screen.getByText("2 selected")).toBeTruthy();
    });

    it("search filters member list by name", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(3, sampleMembers));

      await renderModal();

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[4]); // INDIVIDUAL
      });

      await waitFor(() => {
        expect(screen.getByText("Alice Johnson")).toBeTruthy();
      });

      const searchInput = screen.getByPlaceholderText("Search members...");
      fireEvent.change(searchInput, { target: { value: "alice" } });

      expect(screen.getByText("Alice Johnson")).toBeTruthy();
      expect(screen.queryByText("Bob Smith")).toBeNull();
      expect(screen.queryByText("Charlie Brown")).toBeNull();
    });

    it("search is case-insensitive", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(3, sampleMembers));

      await renderModal();

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[4]); // INDIVIDUAL
      });

      await waitFor(() => {
        expect(screen.getByText("Bob Smith")).toBeTruthy();
      });

      const searchInput = screen.getByPlaceholderText("Search members...");
      fireEvent.change(searchInput, { target: { value: "BOB" } });

      expect(screen.getByText("Bob Smith")).toBeTruthy();
      expect(screen.queryByText("Alice Johnson")).toBeNull();
    });
  });

  // ========================
  // Recipient Count Display
  // ========================

  describe("Recipient count display", () => {
    it("shows 'Will notify X members' for ALL audience", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(5));

      await renderModal();

      await waitFor(() => {
        expect(screen.getByText("Will notify 5 members")).toBeTruthy();
      });
    });

    it("shows 'Counting recipients...' when loading", async () => {
      mockFetch.mockImplementation(
        () => new Promise(() => {})
      );

      await renderModal();

      await waitFor(() => {
        expect(screen.getByText("Counting recipients...")).toBeTruthy();
      });
    });

    it("shows 'Will notify 0 members' for SESSION_SLOT with no slot selected", async () => {
      await renderModal();

      // Wait for initial fetch
      await waitFor(() => {
        expect(screen.getByText(/Will notify/)).toBeTruthy();
      });

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[2]); // SESSION_SLOT
      });

      // With no slot selected, should show 0
      expect(screen.getByText("Will notify 0 members")).toBeTruthy();
    });

    it("does NOT show recipient count text for INDIVIDUAL audience", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(3, sampleMembers));

      await renderModal();

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[4]); // INDIVIDUAL
      });

      await waitFor(() => {
        expect(screen.queryByText(/Will notify/)).toBeNull();
        expect(screen.queryByText(/Counting recipients/)).toBeNull();
      });
    });

    it("shows singular 'Will notify 1 member' for count of 1", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(1));

      await renderModal();

      await waitFor(() => {
        expect(screen.getByText("Will notify 1 member")).toBeTruthy();
      });
    });

    it("shows plural 'Will notify 2 members' for count of 2", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(2));

      await renderModal();

      await waitFor(() => {
        expect(screen.getByText("Will notify 2 members")).toBeTruthy();
      });
    });
  });

  // ========================
  // Send Button State
  // ========================

  describe("Send button state", () => {
    it("disabled when title is empty", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(5));

      await renderModal();

      // Body filled, title empty
      const bodyInput = screen.getByPlaceholderText("Write your message here...");
      fireEvent.change(bodyInput, { target: { value: "Some body text" } });

      const sendButton = screen.getByRole("button", { name: "Send Notification" });
      expect(sendButton.hasAttribute("disabled")).toBe(true);
    });

    it("disabled when body is empty", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(5));

      await renderModal();

      // Title filled, body empty
      const titleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      fireEvent.change(titleInput, { target: { value: "A title" } });

      const sendButton = screen.getByRole("button", { name: "Send Notification" });
      expect(sendButton.hasAttribute("disabled")).toBe(true);
    });

    it("disabled when recipient count is 0", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(0));

      await renderModal();

      const titleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      const bodyInput = screen.getByPlaceholderText("Write your message here...");
      fireEvent.change(titleInput, { target: { value: "A title" } });
      fireEvent.change(bodyInput, { target: { value: "A body" } });

      const sendButton = screen.getByRole("button", { name: "Send Notification" });
      expect(sendButton.hasAttribute("disabled")).toBe(true);
    });

    it("enabled when title, body, and recipients all present", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(5));

      await renderModal();

      const titleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      const bodyInput = screen.getByPlaceholderText("Write your message here...");
      fireEvent.change(titleInput, { target: { value: "A title" } });
      fireEvent.change(bodyInput, { target: { value: "A body" } });

      const sendButton = screen.getByRole("button", { name: "Send Notification" });
      expect(sendButton.hasAttribute("disabled")).toBe(false);
    });

    it("disabled when title is only whitespace", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(5));

      await renderModal();

      const titleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      const bodyInput = screen.getByPlaceholderText("Write your message here...");
      fireEvent.change(titleInput, { target: { value: "   " } });
      fireEvent.change(bodyInput, { target: { value: "A body" } });

      const sendButton = screen.getByRole("button", { name: "Send Notification" });
      expect(sendButton.hasAttribute("disabled")).toBe(true);
    });

    it("disabled when INDIVIDUAL and no members selected", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(3, sampleMembers));

      await renderModal();

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[4]); // INDIVIDUAL
      });

      await waitFor(() => {
        expect(screen.getByText("Alice Johnson")).toBeTruthy();
      });

      const titleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      const bodyInput = screen.getByPlaceholderText("Write your message here...");
      fireEvent.change(titleInput, { target: { value: "A title" } });
      fireEvent.change(bodyInput, { target: { value: "A body" } });

      const sendButton = screen.getByRole("button", { name: "Send Notification" });
      expect(sendButton.hasAttribute("disabled")).toBe(true);
    });

    it("enabled when INDIVIDUAL and members are selected", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(3, sampleMembers));

      await renderModal();

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[4]); // INDIVIDUAL
      });

      await waitFor(() => {
        expect(screen.getByText("Alice Johnson")).toBeTruthy();
      });

      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[0]); // Select Alice

      const titleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      const bodyInput = screen.getByPlaceholderText("Write your message here...");
      fireEvent.change(titleInput, { target: { value: "A title" } });
      fireEvent.change(bodyInput, { target: { value: "A body" } });

      const sendButton = screen.getByRole("button", { name: "Send Notification" });
      expect(sendButton.hasAttribute("disabled")).toBe(false);
    });
  });

  // ========================
  // Character Counters
  // ========================

  describe("Character counters", () => {
    it("title counter updates as user types", async () => {
      await renderModal();

      const titleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      fireEvent.change(titleInput, { target: { value: "Hello" } });

      expect(screen.getByText("5/100")).toBeTruthy();
    });

    it("body counter updates as user types", async () => {
      await renderModal();

      const bodyInput = screen.getByPlaceholderText("Write your message here...");
      fireEvent.change(bodyInput, { target: { value: "Hello World" } });

      expect(screen.getByText("11/500")).toBeTruthy();
    });

    it("title counter shows maxed out length", async () => {
      await renderModal();

      const titleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      const longTitle = "a".repeat(100);
      fireEvent.change(titleInput, { target: { value: longTitle } });

      expect(screen.getByText("100/100")).toBeTruthy();
    });
  });

  // ========================
  // Confirmation Flow
  // ========================

  describe("Confirmation flow", () => {
    it("clicking Send opens ConfirmationModal", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(5));

      await renderModal();

      const titleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      const bodyInput = screen.getByPlaceholderText("Write your message here...");
      fireEvent.change(titleInput, { target: { value: "Test title" } });
      fireEvent.change(bodyInput, { target: { value: "Test body" } });

      const sendButton = screen.getByRole("button", { name: "Send Notification" });
      fireEvent.click(sendButton);

      // ConfirmationModal should appear with "Confirm Send" title
      expect(screen.getByText("Confirm Send")).toBeTruthy();
    });

    it("confirmation message includes recipient count", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(5));

      await renderModal();

      const titleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      const bodyInput = screen.getByPlaceholderText("Write your message here...");
      fireEvent.change(titleInput, { target: { value: "Test" } });
      fireEvent.change(bodyInput, { target: { value: "Test" } });

      const sendButton = screen.getByRole("button", { name: "Send Notification" });
      fireEvent.click(sendButton);

      expect(
        screen.getByText("Send this notification to 5 members?")
      ).toBeTruthy();
    });

    it("singular '1 member' vs plural '2 members'", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(1));

      await renderModal();

      const titleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      const bodyInput = screen.getByPlaceholderText("Write your message here...");
      fireEvent.change(titleInput, { target: { value: "Test" } });
      fireEvent.change(bodyInput, { target: { value: "Test" } });

      const sendButton = screen.getByRole("button", { name: "Send Notification" });
      fireEvent.click(sendButton);

      expect(
        screen.getByText("Send this notification to 1 member?")
      ).toBeTruthy();
    });

    it("confirmation modal has Send confirm button", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(5));

      await renderModal();

      const titleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      const bodyInput = screen.getByPlaceholderText("Write your message here...");
      fireEvent.change(titleInput, { target: { value: "Test" } });
      fireEvent.change(bodyInput, { target: { value: "Test" } });

      const sendButton = screen.getByRole("button", { name: "Send Notification" });
      fireEvent.click(sendButton);

      // ConfirmationModal has the "Send" confirm label
      const confirmButtons = screen.getAllByRole("button", { name: "Send" });
      expect(confirmButtons.length).toBeGreaterThan(0);
    });
  });

  // ========================
  // Send Success
  // ========================

  describe("Send success", () => {
    it("calls POST /api/notifications/broadcast with correct payload for ALL", async () => {
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (options?.method === "POST") {
          return Promise.resolve(mockSendResponse(5));
        }
        return Promise.resolve(mockRecipientsResponse(5));
      });

      await renderModal();

      const titleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      const bodyInput = screen.getByPlaceholderText("Write your message here...");
      fireEvent.change(titleInput, { target: { value: "Test title" } });
      fireEvent.change(bodyInput, { target: { value: "Test body" } });

      const sendButton = screen.getByRole("button", { name: "Send Notification" });
      fireEvent.click(sendButton);

      // Click confirm in ConfirmationModal
      const confirmButton = screen.getByRole("button", { name: "Send" });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/notifications/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audience: "ALL",
            title: "Test title",
            body: "Test body",
          }),
        });
      });
    });

    it("calls POST with slotId for SESSION_SLOT", async () => {
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (options?.method === "POST") {
          return Promise.resolve(mockSendResponse(3));
        }
        return Promise.resolve(mockRecipientsResponse(3));
      });

      await renderModal();

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[2]); // SESSION_SLOT
      });

      const select = screen.getByRole("combobox");
      await act(async () => {
        fireEvent.change(select, { target: { value: "slot-1" } });
      });

      await waitFor(() => {
        expect(screen.getByText(/Will notify 3/)).toBeTruthy();
      });

      const titleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      const bodyInput = screen.getByPlaceholderText("Write your message here...");
      fireEvent.change(titleInput, { target: { value: "Slot title" } });
      fireEvent.change(bodyInput, { target: { value: "Slot body" } });

      const sendButton = screen.getByRole("button", { name: "Send Notification" });
      fireEvent.click(sendButton);

      const confirmButton = screen.getByRole("button", { name: "Send" });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/notifications/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audience: "SESSION_SLOT",
            title: "Slot title",
            body: "Slot body",
            slotId: "slot-1",
          }),
        });
      });
    });

    it("calls POST with paymentStatus for PAYMENT_STATUS", async () => {
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (options?.method === "POST") {
          return Promise.resolve(mockSendResponse(2));
        }
        return Promise.resolve(mockRecipientsResponse(2));
      });

      await renderModal();

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[3]); // PAYMENT_STATUS
      });

      await waitFor(() => {
        expect(screen.getByText(/Will notify/)).toBeTruthy();
      });

      const titleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      const bodyInput = screen.getByPlaceholderText("Write your message here...");
      fireEvent.change(titleInput, { target: { value: "Payment title" } });
      fireEvent.change(bodyInput, { target: { value: "Payment body" } });

      const sendButton = screen.getByRole("button", { name: "Send Notification" });
      fireEvent.click(sendButton);

      const confirmButton = screen.getByRole("button", { name: "Send" });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/notifications/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audience: "PAYMENT_STATUS",
            title: "Payment title",
            body: "Payment body",
            paymentStatus: "GRACE_PERIOD",
          }),
        });
      });
    });

    it("calls POST with memberIds for INDIVIDUAL", async () => {
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (options?.method === "POST") {
          return Promise.resolve(mockSendResponse(2));
        }
        return Promise.resolve(mockRecipientsResponse(3, sampleMembers));
      });

      await renderModal();

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[4]); // INDIVIDUAL
      });

      await waitFor(() => {
        expect(screen.getByText("Alice Johnson")).toBeTruthy();
      });

      const checkboxes = screen.getAllByRole("checkbox");
      fireEvent.click(checkboxes[0]); // Alice
      fireEvent.click(checkboxes[1]); // Bob

      const titleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      const bodyInput = screen.getByPlaceholderText("Write your message here...");
      fireEvent.change(titleInput, { target: { value: "Individual title" } });
      fireEvent.change(bodyInput, { target: { value: "Individual body" } });

      const sendButton = screen.getByRole("button", { name: "Send Notification" });
      fireEvent.click(sendButton);

      const confirmButton = screen.getByRole("button", { name: "Send" });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/notifications/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audience: "INDIVIDUAL",
            title: "Individual title",
            body: "Individual body",
            memberIds: ["m-1", "m-2"],
          }),
        });
      });
    });

    it("shows success toast with sent count on success", async () => {
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (options?.method === "POST") {
          return Promise.resolve(mockSendResponse(5));
        }
        return Promise.resolve(mockRecipientsResponse(5));
      });

      await renderModal();

      const titleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      const bodyInput = screen.getByPlaceholderText("Write your message here...");
      fireEvent.change(titleInput, { target: { value: "Test" } });
      fireEvent.change(bodyInput, { target: { value: "Test" } });

      const sendButton = screen.getByRole("button", { name: "Send Notification" });
      fireEvent.click(sendButton);

      const confirmButton = screen.getByRole("button", { name: "Send" });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "success",
          title: "Notification sent to 5 members",
        });
      });
    });

    it("success toast uses singular for 1 member", async () => {
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (options?.method === "POST") {
          return Promise.resolve(mockSendResponse(1));
        }
        return Promise.resolve(mockRecipientsResponse(1));
      });

      await renderModal();

      const titleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      const bodyInput = screen.getByPlaceholderText("Write your message here...");
      fireEvent.change(titleInput, { target: { value: "Test" } });
      fireEvent.change(bodyInput, { target: { value: "Test" } });

      const sendButton = screen.getByRole("button", { name: "Send Notification" });
      fireEvent.click(sendButton);

      const confirmButton = screen.getByRole("button", { name: "Send" });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "success",
          title: "Notification sent to 1 member",
        });
      });
    });

    it("closes modal on success", async () => {
      const onClose = vi.fn();
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (options?.method === "POST") {
          return Promise.resolve(mockSendResponse(5));
        }
        return Promise.resolve(mockRecipientsResponse(5));
      });

      await renderModal({ onClose });

      const titleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      const bodyInput = screen.getByPlaceholderText("Write your message here...");
      fireEvent.change(titleInput, { target: { value: "Test" } });
      fireEvent.change(bodyInput, { target: { value: "Test" } });

      const sendButton = screen.getByRole("button", { name: "Send Notification" });
      fireEvent.click(sendButton);

      const confirmButton = screen.getByRole("button", { name: "Send" });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it("calls router.refresh on success", async () => {
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (options?.method === "POST") {
          return Promise.resolve(mockSendResponse(5));
        }
        return Promise.resolve(mockRecipientsResponse(5));
      });

      await renderModal();

      const titleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      const bodyInput = screen.getByPlaceholderText("Write your message here...");
      fireEvent.change(titleInput, { target: { value: "Test" } });
      fireEvent.change(bodyInput, { target: { value: "Test" } });

      const sendButton = screen.getByRole("button", { name: "Send Notification" });
      fireEvent.click(sendButton);

      const confirmButton = screen.getByRole("button", { name: "Send" });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });
  });

  // ========================
  // Send Failure
  // ========================

  describe("Send failure", () => {
    it("shows error toast on API error response", async () => {
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (options?.method === "POST") {
          return Promise.resolve(mockErrorResponse("Validation failed", 400));
        }
        return Promise.resolve(mockRecipientsResponse(5));
      });

      await renderModal();

      const titleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      const bodyInput = screen.getByPlaceholderText("Write your message here...");
      fireEvent.change(titleInput, { target: { value: "Test" } });
      fireEvent.change(bodyInput, { target: { value: "Test" } });

      const sendButton = screen.getByRole("button", { name: "Send Notification" });
      fireEvent.click(sendButton);

      const confirmButton = screen.getByRole("button", { name: "Send" });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "error",
          title: "Validation failed",
        });
      });
    });

    it("shows generic error toast when API returns no error message", async () => {
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (options?.method === "POST") {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({}),
          });
        }
        return Promise.resolve(mockRecipientsResponse(5));
      });

      await renderModal();

      const titleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      const bodyInput = screen.getByPlaceholderText("Write your message here...");
      fireEvent.change(titleInput, { target: { value: "Test" } });
      fireEvent.change(bodyInput, { target: { value: "Test" } });

      const sendButton = screen.getByRole("button", { name: "Send Notification" });
      fireEvent.click(sendButton);

      const confirmButton = screen.getByRole("button", { name: "Send" });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "error",
          title: "Failed to send notification",
        });
      });
    });

    it("shows error toast on network error", async () => {
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (options?.method === "POST") {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve(mockRecipientsResponse(5));
      });

      await renderModal();

      const titleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      const bodyInput = screen.getByPlaceholderText("Write your message here...");
      fireEvent.change(titleInput, { target: { value: "Test" } });
      fireEvent.change(bodyInput, { target: { value: "Test" } });

      const sendButton = screen.getByRole("button", { name: "Send Notification" });
      fireEvent.click(sendButton);

      const confirmButton = screen.getByRole("button", { name: "Send" });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: "error",
          title: "Failed to send notification",
        });
      });
    });

    it("modal stays open on error", async () => {
      const onClose = vi.fn();
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (options?.method === "POST") {
          return Promise.resolve(mockErrorResponse("Error", 400));
        }
        return Promise.resolve(mockRecipientsResponse(5));
      });

      await renderModal({ onClose });

      const titleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      const bodyInput = screen.getByPlaceholderText("Write your message here...");
      fireEvent.change(titleInput, { target: { value: "Test" } });
      fireEvent.change(bodyInput, { target: { value: "Test" } });

      const sendButton = screen.getByRole("button", { name: "Send Notification" });
      fireEvent.click(sendButton);

      const confirmButton = screen.getByRole("button", { name: "Send" });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({ type: "error" })
        );
      });

      // Modal should NOT have been closed
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ========================
  // Form Reset
  // ========================

  describe("Form reset", () => {
    it("resets all fields when modal closes", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(5));

      const mod = await import("@/components/notification/SendNotificationModal");
      const { rerender } = await renderModal();

      // Fill in some fields
      const titleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      const bodyInput = screen.getByPlaceholderText("Write your message here...");
      fireEvent.change(titleInput, { target: { value: "Typed title" } });
      fireEvent.change(bodyInput, { target: { value: "Typed body" } });

      // Verify changes
      expect((titleInput as HTMLInputElement).value).toBe("Typed title");
      expect((bodyInput as HTMLTextAreaElement).value).toBe("Typed body");

      // Close the modal
      rerender(
        <mod.SendNotificationModal {...defaultProps} isOpen={false} />
      );

      // Re-open the modal
      mockFetch.mockResolvedValue(mockRecipientsResponse(5));
      await act(async () => {
        rerender(
          <mod.SendNotificationModal {...defaultProps} isOpen={true} />
        );
      });

      // Fields should be reset
      const newTitleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      const newBodyInput = screen.getByPlaceholderText("Write your message here...");
      expect((newTitleInput as HTMLInputElement).value).toBe("");
      expect((newBodyInput as HTMLTextAreaElement).value).toBe("");
      expect(screen.getByText("0/100")).toBeTruthy();
      expect(screen.getByText("0/500")).toBeTruthy();
    });

    it("resets audience back to ALL when modal closes and reopens", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(5));

      const mod = await import("@/components/notification/SendNotificationModal");
      const { rerender } = await renderModal();

      // Change audience to TRIAL
      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[1]);
      });
      expect((radios[1] as HTMLInputElement).checked).toBe(true);

      // Close and reopen
      rerender(
        <mod.SendNotificationModal {...defaultProps} isOpen={false} />
      );
      mockFetch.mockResolvedValue(mockRecipientsResponse(5));
      await act(async () => {
        rerender(
          <mod.SendNotificationModal {...defaultProps} isOpen={true} />
        );
      });

      // Should be back to ALL
      const newRadios = screen.getAllByRole("radio");
      expect((newRadios[0] as HTMLInputElement).checked).toBe(true);
    });
  });

  // ========================
  // Fetch Behavior
  // ========================

  describe("Fetch behavior", () => {
    it("fetches recipients when modal opens", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(5));

      await renderModal();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/notifications/broadcast/recipients")
        );
      });
    });

    it("fetches when audience changes", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(5));

      await renderModal();

      mockFetch.mockClear();
      mockFetch.mockResolvedValue(mockRecipientsResponse(2));

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[1]); // TRIAL
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("audience=TRIAL")
        );
      });
    });

    it("does NOT fetch when SESSION_SLOT and no slot selected", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(5));

      await renderModal();

      mockFetch.mockClear();

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[2]); // SESSION_SLOT
      });

      // Should set count to 0 without fetching
      expect(screen.getByText("Will notify 0 members")).toBeTruthy();
      // fetch should NOT have been called for the SESSION_SLOT without slot
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("fetches when slot changes for SESSION_SLOT", async () => {
      mockFetch.mockResolvedValue(mockRecipientsResponse(5));

      await renderModal();

      const radios = screen.getAllByRole("radio");
      await act(async () => {
        fireEvent.click(radios[2]); // SESSION_SLOT
      });

      mockFetch.mockClear();
      mockFetch.mockResolvedValue(mockRecipientsResponse(3));

      const select = screen.getByRole("combobox");
      await act(async () => {
        fireEvent.change(select, { target: { value: "slot-1" } });
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("slotId=slot-1")
        );
      });
    });

    it("does not fetch when modal is closed", async () => {
      await renderModal({ isOpen: false });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ========================
  // Cancel Button
  // ========================

  describe("Cancel button", () => {
    it("calls onClose when Cancel is clicked", async () => {
      const onClose = vi.fn();

      await renderModal({ onClose });

      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      fireEvent.click(cancelButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ========================
  // Title trimming on send
  // ========================

  describe("Title and body trimming", () => {
    it("trims whitespace from title and body before sending", async () => {
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        if (options?.method === "POST") {
          return Promise.resolve(mockSendResponse(5));
        }
        return Promise.resolve(mockRecipientsResponse(5));
      });

      await renderModal();

      const titleInput = screen.getByPlaceholderText("e.g., Studio closed this Friday");
      const bodyInput = screen.getByPlaceholderText("Write your message here...");
      fireEvent.change(titleInput, { target: { value: "  Padded title  " } });
      fireEvent.change(bodyInput, { target: { value: "  Padded body  " } });

      const sendButton = screen.getByRole("button", { name: "Send Notification" });
      fireEvent.click(sendButton);

      const confirmButton = screen.getByRole("button", { name: "Send" });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/notifications/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audience: "ALL",
            title: "Padded title",
            body: "Padded body",
          }),
        });
      });
    });
  });
});
