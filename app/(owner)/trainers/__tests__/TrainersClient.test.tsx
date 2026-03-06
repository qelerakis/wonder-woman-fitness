/**
 * TrainersClient Component Tests
 *
 * Comprehensive tests covering:
 * - Initial rendering (empty state, with trainers)
 * - Trainer table display (name, email, phone, status, date)
 * - Add Trainer modal (open/close, member loading, search/filter)
 * - Member selection and confirmation flow
 * - Promotion API call (success, error, network failure)
 * - Modal state reset on close
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { TrainersClient } from "../TrainersClient";

// ===== Mocks =====

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const mockAddToast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

// ===== Helpers =====

interface TrainerData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  createdAt: string;
}

function makeTrainer(overrides: Partial<TrainerData> = {}): TrainerData {
  return {
    id: "t1",
    name: "Ana Trainer",
    email: "ana@test.com",
    phone: "+389 71 123 456",
    status: "ACTIVE",
    createdAt: "2026-01-15T10:00:00.000Z",
    ...overrides,
  };
}

const sampleMembers = [
  { id: "m1", name: "Alice Member", email: "alice@test.com", status: "ACTIVE" },
  { id: "m2", name: "Bob Member", email: "bob@test.com", status: "ACTIVE" },
  { id: "m3", name: "Carol Trial", email: "carol@test.com", status: "TRIAL" },
];

let mockFetch: ReturnType<typeof vi.fn>;

function setupFetchMembers(members = sampleMembers): void {
  mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: members }),
  });
  global.fetch = mockFetch as unknown as typeof fetch;
}

function setupFetchMembersError(): void {
  mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
  global.fetch = mockFetch as unknown as typeof fetch;
}

/** Open the modal, wait for fetch to resolve and members to render */
async function openModalAndWaitForMembers(): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /add trainer/i }));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** Click a member button by matching text content */
async function clickMember(name: string): Promise<void> {
  const buttons = screen.getAllByRole("button");
  const memberBtn = buttons.find((b) => b.textContent?.includes(name));
  if (!memberBtn) throw new Error(`Member button with text "${name}" not found`);
  await act(async () => {
    fireEvent.click(memberBtn);
  });
}

// ===== Tests =====

describe("TrainersClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupFetchMembers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Initial rendering ---

  describe("initial rendering", () => {
    it("renders the page title", () => {
      render(<TrainersClient trainers={[]} />);
      expect(screen.getByText("Trainers")).toBeTruthy();
    });

    it("shows trainer count", () => {
      render(<TrainersClient trainers={[makeTrainer()]} />);
      expect(screen.getByText(/1 trainer/i)).toBeTruthy();
    });

    it("shows count for multiple trainers", () => {
      const trainers = [
        makeTrainer({ id: "t1", name: "Ana" }),
        makeTrainer({ id: "t2", name: "Bob" }),
      ];
      render(<TrainersClient trainers={trainers} />);
      expect(screen.getByText(/2 trainer/i)).toBeTruthy();
    });

    it("shows Add Trainer button", () => {
      render(<TrainersClient trainers={[]} />);
      expect(screen.getByRole("button", { name: /add trainer/i })).toBeTruthy();
    });
  });

  // --- Empty state ---

  describe("empty state", () => {
    it("shows empty state message when no trainers", () => {
      render(<TrainersClient trainers={[]} />);
      expect(screen.getByText(/no trainers yet/i)).toBeTruthy();
    });

    it("does not show table when no trainers", () => {
      render(<TrainersClient trainers={[]} />);
      expect(screen.queryByRole("table")).toBeNull();
    });
  });

  // --- Trainer table ---

  describe("trainer table", () => {
    it("renders table with column headers", () => {
      render(<TrainersClient trainers={[makeTrainer()]} />);
      expect(screen.getByText("Name")).toBeTruthy();
      expect(screen.getByText("Email")).toBeTruthy();
      expect(screen.getByText("Phone")).toBeTruthy();
      expect(screen.getByText("Status")).toBeTruthy();
      expect(screen.getByText("Added")).toBeTruthy();
    });

    it("displays trainer name", () => {
      render(<TrainersClient trainers={[makeTrainer()]} />);
      expect(screen.getByText("Ana Trainer")).toBeTruthy();
    });

    it("displays trainer email", () => {
      render(<TrainersClient trainers={[makeTrainer()]} />);
      expect(screen.getByText("ana@test.com")).toBeTruthy();
    });

    it("displays trainer phone", () => {
      render(<TrainersClient trainers={[makeTrainer()]} />);
      expect(screen.getByText("+389 71 123 456")).toBeTruthy();
    });

    it("displays em-dash when phone is null", () => {
      render(<TrainersClient trainers={[makeTrainer({ phone: null })]} />);
      expect(screen.getByText("\u2014")).toBeTruthy();
    });

    it("displays trainer status badge", () => {
      render(<TrainersClient trainers={[makeTrainer({ status: "ACTIVE" })]} />);
      expect(screen.getByText("ACTIVE")).toBeTruthy();
    });

    it("displays formatted date", () => {
      render(<TrainersClient trainers={[makeTrainer({ createdAt: "2026-01-15T10:00:00.000Z" })]} />);
      expect(screen.getByText("Jan 15, 2026")).toBeTruthy();
    });

    it("renders multiple trainers", () => {
      const trainers = [
        makeTrainer({ id: "t1", name: "First Trainer", email: "first@test.com" }),
        makeTrainer({ id: "t2", name: "Second Trainer", email: "second@test.com" }),
        makeTrainer({ id: "t3", name: "Third Trainer", email: "third@test.com" }),
      ];
      render(<TrainersClient trainers={trainers} />);
      expect(screen.getByText("First Trainer")).toBeTruthy();
      expect(screen.getByText("Second Trainer")).toBeTruthy();
      expect(screen.getByText("Third Trainer")).toBeTruthy();
    });
  });

  // --- Modal open/close ---

  describe("modal open/close", () => {
    it("opens modal when Add Trainer is clicked", async () => {
      render(<TrainersClient trainers={[]} />);
      await openModalAndWaitForMembers();
      expect(screen.getByText(/select a member to promote/i)).toBeTruthy();
    });

    it("closes modal when Cancel is clicked", async () => {
      render(<TrainersClient trainers={[]} />);
      await openModalAndWaitForMembers();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      });
      expect(screen.queryByText(/select a member to promote/i)).toBeNull();
    });

    it("fetches members when modal opens", async () => {
      render(<TrainersClient trainers={[]} />);
      await openModalAndWaitForMembers();
      expect(mockFetch).toHaveBeenCalledWith("/api/members");
    });

    it("resets state when modal closes and reopens", async () => {
      render(<TrainersClient trainers={[]} />);

      // Open, select a member, close
      await openModalAndWaitForMembers();
      await clickMember("Alice Member");
      expect(screen.getByText(/promote alice member to trainer/i)).toBeTruthy();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      });
      expect(screen.queryByText(/promote alice member to trainer/i)).toBeNull();

      // Reopen - should be back to member selection
      await openModalAndWaitForMembers();
      expect(screen.getByText(/select a member to promote/i)).toBeTruthy();
    });
  });

  // --- Member loading ---

  describe("member loading", () => {
    it("shows loading state while fetching members", async () => {
      let resolveFetch!: (value: unknown) => void;
      global.fetch = vi.fn().mockReturnValue(
        new Promise((resolve) => { resolveFetch = resolve; })
      ) as unknown as typeof fetch;

      render(<TrainersClient trainers={[]} />);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /add trainer/i }));
      });

      expect(screen.getByText(/loading members/i)).toBeTruthy();

      // Resolve to clean up
      await act(async () => {
        resolveFetch({ ok: true, json: () => Promise.resolve({ data: [] }) });
        await new Promise((r) => setTimeout(r, 0));
      });
    });

    it("shows no members message when member list is empty", async () => {
      setupFetchMembers([]);
      render(<TrainersClient trainers={[]} />);
      await openModalAndWaitForMembers();
      expect(screen.getByText(/no members available/i)).toBeTruthy();
    });

    it("filters out DEPARTED members from the list", async () => {
      const members = [
        { id: "m1", name: "Active One", email: "active@test.com", status: "ACTIVE" },
        { id: "m2", name: "Departed One", email: "departed@test.com", status: "DEPARTED" },
      ];
      setupFetchMembers(members);
      render(<TrainersClient trainers={[]} />);
      await openModalAndWaitForMembers();

      expect(screen.getByText("Active One")).toBeTruthy();
      expect(screen.queryByText("Departed One")).toBeNull();
    });

    it("shows error toast when member fetch fails", async () => {
      setupFetchMembersError();
      render(<TrainersClient trainers={[]} />);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /add trainer/i }));
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error" })
      );
    });
  });

  // --- Member list display ---

  describe("member list display", () => {
    it("displays member names in the list", async () => {
      render(<TrainersClient trainers={[]} />);
      await openModalAndWaitForMembers();

      expect(screen.getByText("Alice Member")).toBeTruthy();
      expect(screen.getByText("Bob Member")).toBeTruthy();
      expect(screen.getByText("Carol Trial")).toBeTruthy();
    });

    it("displays member emails in the list", async () => {
      render(<TrainersClient trainers={[]} />);
      await openModalAndWaitForMembers();

      expect(screen.getByText("alice@test.com")).toBeTruthy();
      expect(screen.getByText("bob@test.com")).toBeTruthy();
    });

    it("displays member status badges", async () => {
      render(<TrainersClient trainers={[]} />);
      await openModalAndWaitForMembers();

      const activeBadges = screen.getAllByText("ACTIVE");
      expect(activeBadges.length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText("TRIAL")).toBeTruthy();
    });

    it("renders members as clickable buttons", async () => {
      render(<TrainersClient trainers={[]} />);
      await openModalAndWaitForMembers();

      const buttons = screen.getAllByRole("button");
      const memberButtons = buttons.filter(
        (b) => b.textContent?.includes("Alice") || b.textContent?.includes("Bob") || b.textContent?.includes("Carol")
      );
      expect(memberButtons.length).toBe(3);
    });
  });

  // --- Search/filter ---

  describe("search and filtering", () => {
    it("renders search input", async () => {
      render(<TrainersClient trainers={[]} />);
      await openModalAndWaitForMembers();
      expect(screen.getByPlaceholderText(/search members/i)).toBeTruthy();
    });

    it("filters members by name", async () => {
      render(<TrainersClient trainers={[]} />);
      await openModalAndWaitForMembers();

      fireEvent.change(screen.getByPlaceholderText(/search members/i), { target: { value: "Alice" } });

      expect(screen.getByText("Alice Member")).toBeTruthy();
      expect(screen.queryByText("Bob Member")).toBeNull();
      expect(screen.queryByText("Carol Trial")).toBeNull();
    });

    it("filters members by email", async () => {
      render(<TrainersClient trainers={[]} />);
      await openModalAndWaitForMembers();

      fireEvent.change(screen.getByPlaceholderText(/search members/i), { target: { value: "bob@" } });

      expect(screen.queryByText("Alice Member")).toBeNull();
      expect(screen.getByText("Bob Member")).toBeTruthy();
    });

    it("is case insensitive", async () => {
      render(<TrainersClient trainers={[]} />);
      await openModalAndWaitForMembers();

      fireEvent.change(screen.getByPlaceholderText(/search members/i), { target: { value: "ALICE" } });

      expect(screen.getByText("Alice Member")).toBeTruthy();
    });

    it("shows no members message when search has no matches", async () => {
      render(<TrainersClient trainers={[]} />);
      await openModalAndWaitForMembers();

      fireEvent.change(screen.getByPlaceholderText(/search members/i), { target: { value: "nonexistent" } });

      expect(screen.getByText(/no members available/i)).toBeTruthy();
    });

    it("shows all members when search is cleared", async () => {
      render(<TrainersClient trainers={[]} />);
      await openModalAndWaitForMembers();

      const searchInput = screen.getByPlaceholderText(/search members/i);

      // Filter to one
      fireEvent.change(searchInput, { target: { value: "Alice" } });
      expect(screen.queryByText("Bob Member")).toBeNull();

      // Clear search
      fireEvent.change(searchInput, { target: { value: "" } });
      expect(screen.getByText("Alice Member")).toBeTruthy();
      expect(screen.getByText("Bob Member")).toBeTruthy();
      expect(screen.getByText("Carol Trial")).toBeTruthy();
    });

    it("trims whitespace in search query", async () => {
      render(<TrainersClient trainers={[]} />);
      await openModalAndWaitForMembers();

      fireEvent.change(screen.getByPlaceholderText(/search members/i), { target: { value: "  " } });

      // All should still be visible with whitespace-only search
      expect(screen.getByText("Alice Member")).toBeTruthy();
      expect(screen.getByText("Bob Member")).toBeTruthy();
    });
  });

  // --- Confirmation step ---

  describe("confirmation step", () => {
    it("shows confirmation when member is selected", async () => {
      render(<TrainersClient trainers={[]} />);
      await openModalAndWaitForMembers();
      await clickMember("Alice Member");

      expect(screen.getByText(/promote alice member to trainer/i)).toBeTruthy();
    });

    it("shows confirmation message about permanent change", async () => {
      render(<TrainersClient trainers={[]} />);
      await openModalAndWaitForMembers();
      await clickMember("Alice Member");

      expect(screen.getByText(/cannot be undone/i)).toBeTruthy();
    });

    it("shows Promote to Trainer button", async () => {
      render(<TrainersClient trainers={[]} />);
      await openModalAndWaitForMembers();
      await clickMember("Alice Member");

      expect(screen.getByRole("button", { name: /promote to trainer/i })).toBeTruthy();
    });

    it("shows Cancel button in confirmation step", async () => {
      render(<TrainersClient trainers={[]} />);
      await openModalAndWaitForMembers();
      await clickMember("Alice Member");

      expect(screen.getByRole("button", { name: /cancel/i })).toBeTruthy();
    });

    it("returns to member list when Cancel is clicked in confirmation", async () => {
      render(<TrainersClient trainers={[]} />);
      await openModalAndWaitForMembers();
      await clickMember("Alice Member");

      expect(screen.getByText(/promote alice member to trainer/i)).toBeTruthy();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      });

      // Should be back to member list
      expect(screen.getByText(/select a member to promote/i)).toBeTruthy();
      expect(screen.getByText("Alice Member")).toBeTruthy();
    });

    it("hides member list and search when showing confirmation", async () => {
      render(<TrainersClient trainers={[]} />);
      await openModalAndWaitForMembers();
      await clickMember("Alice Member");

      expect(screen.queryByPlaceholderText(/search members/i)).toBeNull();
    });
  });

  // --- Promote action (success) ---

  describe("promote success", () => {
    async function openAndSelectMember(): Promise<void> {
      await openModalAndWaitForMembers();
      await clickMember("Alice Member");
      expect(screen.getByText(/promote alice member/i)).toBeTruthy();

      // Replace fetch for the promote call
      mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { role: "TRAINER", trainers: [] } }),
      });
      global.fetch = mockFetch as unknown as typeof fetch;
    }

    it("calls POST /api/trainers with the selected member ID", async () => {
      render(<TrainersClient trainers={[]} />);
      await openAndSelectMember();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /promote to trainer/i }));
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/trainers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: "m1" }),
      });
    });

    it("shows success toast on promotion", async () => {
      render(<TrainersClient trainers={[]} />);
      await openAndSelectMember();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /promote to trainer/i }));
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "success",
          title: "Trainer added",
        })
      );
    });

    it("includes member name in success toast message", async () => {
      render(<TrainersClient trainers={[]} />);
      await openAndSelectMember();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /promote to trainer/i }));
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Alice Member"),
        })
      );
    });

    it("closes modal after successful promotion", async () => {
      render(<TrainersClient trainers={[]} />);
      await openAndSelectMember();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /promote to trainer/i }));
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(screen.queryByText(/promote alice member to trainer/i)).toBeNull();
    });

    it("calls router.refresh after successful promotion", async () => {
      render(<TrainersClient trainers={[]} />);
      await openAndSelectMember();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /promote to trainer/i }));
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  // --- Promote action (error) ---

  describe("promote error handling", () => {
    async function openAndSelectMember(): Promise<void> {
      await openModalAndWaitForMembers();
      await clickMember("Alice Member");
      expect(screen.getByText(/promote alice member/i)).toBeTruthy();
    }

    it("shows error toast when API returns error", async () => {
      render(<TrainersClient trainers={[]} />);
      await openAndSelectMember();

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "User is already a trainer or owner" }),
      }) as unknown as typeof fetch;

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /promote to trainer/i }));
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: "Failed to promote member",
          message: "User is already a trainer or owner",
        })
      );
    });

    it("handles non-string error response gracefully", async () => {
      render(<TrainersClient trainers={[]} />);
      await openAndSelectMember();

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: { fieldErrors: { memberId: ["Invalid"] } } }),
      }) as unknown as typeof fetch;

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /promote to trainer/i }));
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: "Failed to promote member",
          message: "Failed to promote member",
        })
      );
    });

    it("shows network error toast on fetch failure", async () => {
      render(<TrainersClient trainers={[]} />);
      await openAndSelectMember();

      global.fetch = vi.fn().mockRejectedValue(new Error("Network failed")) as unknown as typeof fetch;

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /promote to trainer/i }));
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: "Network error",
        })
      );
    });

    it("does not close modal on error", async () => {
      render(<TrainersClient trainers={[]} />);
      await openAndSelectMember();

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Something failed" }),
      }) as unknown as typeof fetch;

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /promote to trainer/i }));
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      // Confirmation should still be visible
      expect(screen.getByText(/promote alice member to trainer/i)).toBeTruthy();
    });

    it("does not call router.refresh on error", async () => {
      render(<TrainersClient trainers={[]} />);
      await openAndSelectMember();

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Failed" }),
      }) as unknown as typeof fetch;

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /promote to trainer/i }));
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });

  // --- Loading state ---

  describe("promote button visibility", () => {
    it("does not show Promote button before selecting a member", async () => {
      render(<TrainersClient trainers={[]} />);
      await openModalAndWaitForMembers();
      expect(screen.queryByRole("button", { name: /promote to trainer/i })).toBeNull();
    });
  });

  // --- Different member types ---

  describe("different member types", () => {
    it("can select TRIAL status member", async () => {
      render(<TrainersClient trainers={[]} />);
      await openModalAndWaitForMembers();
      await clickMember("Carol Trial");

      expect(screen.getByText(/promote carol trial to trainer/i)).toBeTruthy();
    });

    it("shows TRIAL badge for trial members", async () => {
      render(<TrainersClient trainers={[]} />);
      await openModalAndWaitForMembers();

      expect(screen.getByText("TRIAL")).toBeTruthy();
    });
  });

  // --- Integration: full flow ---

  describe("full promotion flow", () => {
    it("completes full flow: open, search, select, confirm, promote", async () => {
      render(<TrainersClient trainers={[]} />);

      // 1. Open modal and wait for members
      await openModalAndWaitForMembers();
      expect(screen.getByText(/select a member to promote/i)).toBeTruthy();

      // 2. Search
      fireEvent.change(screen.getByPlaceholderText(/search members/i), { target: { value: "Bob" } });
      expect(screen.queryByText("Alice Member")).toBeNull();
      expect(screen.getByText("Bob Member")).toBeTruthy();

      // 3. Select member
      await clickMember("Bob Member");
      expect(screen.getByText(/promote bob member to trainer/i)).toBeTruthy();

      // 4. Mock the promote API
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: { role: "TRAINER", trainers: [] } }),
      }) as unknown as typeof fetch;

      // 5. Confirm promotion
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /promote to trainer/i }));
      });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });

      // 6. Verify success
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "success",
          message: expect.stringContaining("Bob Member"),
        })
      );
      expect(mockRefresh).toHaveBeenCalled();
    });

    it("can go back from confirmation and select different member", async () => {
      render(<TrainersClient trainers={[]} />);
      await openModalAndWaitForMembers();

      // Select Alice
      await clickMember("Alice Member");
      expect(screen.getByText(/promote alice member to trainer/i)).toBeTruthy();

      // Go back
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      });
      expect(screen.getByText(/select a member to promote/i)).toBeTruthy();

      // Select Bob instead
      await clickMember("Bob Member");
      expect(screen.getByText(/promote bob member to trainer/i)).toBeTruthy();
    });
  });
});
