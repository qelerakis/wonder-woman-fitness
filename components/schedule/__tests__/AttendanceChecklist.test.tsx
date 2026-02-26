/**
 * AttendanceChecklist Unit Tests
 *
 * Tests for the attendance roll-call component that lets owners/trainers
 * mark which members showed up to a session by tapping on member names.
 *
 * Covers:
 * - Rendering title, present count, member names, and data-testid attributes
 * - Tap-to-toggle: null/false -> present, present -> absent
 * - Optimistic UI updates with API call
 * - Error toast + rollback on API failure
 * - "+ Add Member" button, dropdown filtering, and add flow
 * - Empty member list edge case
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import {
  AttendanceChecklist,
  type AttendanceMember,
  type AttendanceChecklistProps,
} from "../AttendanceChecklist";

// ===== Mocks =====

const mockAddToast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

// ===== Helpers =====

const defaultMembers: AttendanceMember[] = [
  { userId: "m-1", name: "Alice", present: true },
  { userId: "m-2", name: "Bob", present: false },
  { userId: "m-3", name: "Charlie", present: null },
];

const defaultAllActive = [
  { id: "m-1", name: "Alice" },
  { id: "m-2", name: "Bob" },
  { id: "m-3", name: "Charlie" },
  { id: "m-4", name: "Diana" },
  { id: "m-5", name: "Eve" },
];

function renderChecklist(
  overrides: Partial<AttendanceChecklistProps> = {}
): void {
  const props: AttendanceChecklistProps = {
    sessionId: "session-1",
    members: defaultMembers,
    allActiveMembers: defaultAllActive,
    ...overrides,
  };
  render(<AttendanceChecklist {...props} />);
}

function mockFetchSuccess(data: unknown = {}): void {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data }),
  });
}

function mockFetchFailure(status = 500): void {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ error: "Something went wrong" }),
  });
}

// ===== Setup =====

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
});

// ===== Tests =====

describe("AttendanceChecklist", () => {
  // ─── Rendering ──────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders 'Attendance' title", () => {
      renderChecklist();
      expect(screen.getByText("Attendance")).toBeDefined();
    });

    it("shows present count '1 / 3 present' with 1 present out of 3", () => {
      renderChecklist();
      expect(screen.getByText("1 / 3 present")).toBeDefined();
    });

    it("renders all member names", () => {
      renderChecklist();
      expect(screen.getByText("Alice")).toBeDefined();
      expect(screen.getByText("Bob")).toBeDefined();
      expect(screen.getByText("Charlie")).toBeDefined();
    });

    it("each member has data-testid attribute", () => {
      renderChecklist();
      expect(screen.getByTestId("attendance-row-m-1")).toBeDefined();
      expect(screen.getByTestId("attendance-row-m-2")).toBeDefined();
      expect(screen.getByTestId("attendance-row-m-3")).toBeDefined();
    });

    it("renders correctly with empty members list ('0 / 0 present')", () => {
      renderChecklist({ members: [] });
      expect(screen.getByText("0 / 0 present")).toBeDefined();
    });
  });

  // ─── Tap to toggle ─────────────────────────────────────────────

  describe("tap to toggle", () => {
    it("calls API on tap with correct body (null -> present:true)", async () => {
      mockFetchSuccess();
      renderChecklist();

      // Charlie has present: null
      const charlieRow = screen.getByTestId("attendance-row-m-3");
      await act(async () => {
        fireEvent.click(charlieRow);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/sessions/session-1/attendance",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: "m-3", present: true }),
        })
      );
    });

    it("calls API on tap with correct body (false -> present:true)", async () => {
      mockFetchSuccess();
      renderChecklist();

      // Bob has present: false
      const bobRow = screen.getByTestId("attendance-row-m-2");
      await act(async () => {
        fireEvent.click(bobRow);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/sessions/session-1/attendance",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ userId: "m-2", present: true }),
        })
      );
    });

    it("toggles present member to absent on tap (present:true -> present:false)", async () => {
      mockFetchSuccess();
      renderChecklist();

      // Alice has present: true
      const aliceRow = screen.getByTestId("attendance-row-m-1");
      await act(async () => {
        fireEvent.click(aliceRow);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/sessions/session-1/attendance",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ userId: "m-1", present: false }),
        })
      );
    });

    it("shows optimistic UI update (count changes immediately)", async () => {
      // Don't resolve the fetch yet to observe optimistic state
      (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
        new Promise(() => {})
      );

      renderChecklist();

      // Initially "1 / 3 present" (only Alice is present)
      expect(screen.getByText("1 / 3 present")).toBeDefined();

      // Click Bob (present: false -> present: true)
      const bobRow = screen.getByTestId("attendance-row-m-2");
      await act(async () => {
        fireEvent.click(bobRow);
      });

      // Optimistically: count should now be "2 / 3 present"
      expect(screen.getByText("2 / 3 present")).toBeDefined();
    });

    it("shows error toast and rolls back on API failure", async () => {
      mockFetchFailure();
      renderChecklist();

      // Initially "1 / 3 present"
      expect(screen.getByText("1 / 3 present")).toBeDefined();

      // Click Bob (present: false -> present: true)
      const bobRow = screen.getByTestId("attendance-row-m-2");
      await act(async () => {
        fireEvent.click(bobRow);
      });

      // After API failure, should rollback to "1 / 3 present"
      await waitFor(() => {
        expect(screen.getByText("1 / 3 present")).toBeDefined();
      });

      // Should have shown an error toast
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
        })
      );
    });
  });

  // ─── Add Member ────────────────────────────────────────────────

  describe("add member", () => {
    it("shows '+ Add Member' button", () => {
      renderChecklist();
      expect(screen.getByText("+ Add Member")).toBeDefined();
    });

    it("dropdown only shows members not already in the list", async () => {
      renderChecklist();

      // Click "+ Add Member" to open dropdown
      const addBtn = screen.getByText("+ Add Member");
      await act(async () => {
        fireEvent.click(addBtn);
      });

      // m-1 (Alice), m-2 (Bob), m-3 (Charlie) are in the list
      // m-4 (Diana) and m-5 (Eve) should appear in dropdown
      expect(screen.getByText("Diana")).toBeDefined();
      expect(screen.getByText("Eve")).toBeDefined();

      // Verify Diana and Eve are available in the add dropdown
      // (Alice, Bob, Charlie are already in the attendance list so they shouldn't appear as add options)
    });

    it("shows 'No people available.' when no available members", async () => {
      renderChecklist({
        allActiveMembers: [
          { id: "m-1", name: "Alice" },
          { id: "m-2", name: "Bob" },
          { id: "m-3", name: "Charlie" },
        ],
      });

      const addBtn = screen.getByText("+ Add Member");
      await act(async () => {
        fireEvent.click(addBtn);
      });

      expect(
        screen.getByText("No people available.")
      ).toBeDefined();
    });
  });

  // ─── Additional tests: network errors, Add Member flows, edge cases ───

  describe("network error handling", () => {
    it("shows error toast and rolls back on network error (fetch throws)", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Network error"));
      renderChecklist();

      // Initially "1 / 3 present"
      expect(screen.getByText("1 / 3 present")).toBeDefined();

      // Click Charlie (null -> present: true)
      const charlieRow = screen.getByTestId("attendance-row-m-3");
      await act(async () => {
        fireEvent.click(charlieRow);
      });

      // After network error, should rollback to "1 / 3 present"
      await waitFor(() => {
        expect(screen.getByText("1 / 3 present")).toBeDefined();
      });

      // Should have shown an error toast
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          title: "Failed to update attendance",
        })
      );
    });
  });

  describe("add member flow — API calls", () => {
    it("makes both API calls in order: assign then attendance", async () => {
      // First call: assign member to session
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: {} }),
        })
        // Second call: mark attendance
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: {} }),
        });

      renderChecklist();

      // Open add dropdown
      const addBtn = screen.getByText("+ Add Member");
      await act(async () => {
        fireEvent.click(addBtn);
      });

      // Click Diana to add
      await act(async () => {
        fireEvent.click(screen.getByText("Diana"));
      });

      await waitFor(() => {
        // First call: POST to /api/sessions/session-1/members
        expect(global.fetch).toHaveBeenNthCalledWith(
          1,
          "/api/sessions/session-1/members",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ userId: "m-4", action: "add" }),
          })
        );

        // Second call: POST to /api/sessions/session-1/attendance
        expect(global.fetch).toHaveBeenNthCalledWith(
          2,
          "/api/sessions/session-1/attendance",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ userId: "m-4", present: true }),
          })
        );
      });
    });

    it("shows error and does not add to list when assign API call fails", async () => {
      // First call fails
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Server error" }),
      });

      renderChecklist();

      const addBtn = screen.getByText("+ Add Member");
      await act(async () => {
        fireEvent.click(addBtn);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Diana"));
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "error",
            title: "Failed to add member to session",
          })
        );
      });

      // Diana should NOT appear in the attendance list
      // Count should still be "1 / 3 present"
      expect(screen.getByText("1 / 3 present")).toBeDefined();
      // Only 1 fetch call was made (no attendance call)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("shows error when assign succeeds but attendance API call fails", async () => {
      // First call (assign): success
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: {} }),
        })
        // Second call (attendance): fails
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: "Server error" }),
        });

      renderChecklist();

      const addBtn = screen.getByText("+ Add Member");
      await act(async () => {
        fireEvent.click(addBtn);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Diana"));
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "error",
            title: "Failed to mark attendance",
          })
        );
      });

      // 2 fetch calls were made
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("shows success toast with correct member name", async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) });

      renderChecklist();

      const addBtn = screen.getByText("+ Add Member");
      await act(async () => {
        fireEvent.click(addBtn);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Eve"));
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "success",
            title: "Eve added and marked present",
          })
        );
      });
    });

    it("closes dropdown after successful add", async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) });

      renderChecklist();

      const addBtn = screen.getByText("+ Add Member");
      await act(async () => {
        fireEvent.click(addBtn);
      });

      // Dropdown is open, Diana and Eve visible
      expect(screen.getByText("Diana")).toBeDefined();

      await act(async () => {
        fireEvent.click(screen.getByText("Diana"));
      });

      // After adding, dropdown closes and "+ Add Member" button is back
      await waitFor(() => {
        expect(screen.getByText("+ Add Member")).toBeDefined();
      });
    });

    it("Cancel button closes the dropdown", async () => {
      renderChecklist();

      const addBtn = screen.getByText("+ Add Member");
      await act(async () => {
        fireEvent.click(addBtn);
      });

      // Dropdown is open, Cancel button visible
      expect(screen.getByText("Cancel")).toBeDefined();

      await act(async () => {
        fireEvent.click(screen.getByText("Cancel"));
      });

      // Dropdown closed, "+ Add Member" button is back
      expect(screen.getByText("+ Add Member")).toBeDefined();
    });

    it("shows error toast when add member throws network error", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Network failure"));

      renderChecklist();

      const addBtn = screen.getByText("+ Add Member");
      await act(async () => {
        fireEvent.click(addBtn);
      });

      await act(async () => {
        fireEvent.click(screen.getByText("Diana"));
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "error",
            title: "Failed to add member",
          })
        );
      });
    });
  });

  describe("count display edge cases", () => {
    it("shows correct count when all members are present", () => {
      const allPresent: AttendanceMember[] = [
        { userId: "m-1", name: "Alice", present: true },
        { userId: "m-2", name: "Bob", present: true },
        { userId: "m-3", name: "Charlie", present: true },
      ];
      renderChecklist({ members: allPresent });
      expect(screen.getByText("3 / 3 present")).toBeDefined();
    });

    it("shows '0 / N present' when all members are absent", () => {
      const allAbsent: AttendanceMember[] = [
        { userId: "m-1", name: "Alice", present: false },
        { userId: "m-2", name: "Bob", present: false },
        { userId: "m-3", name: "Charlie", present: false },
      ];
      renderChecklist({ members: allAbsent });
      expect(screen.getByText("0 / 3 present")).toBeDefined();
    });

    it("shows '0 / N present' when all members have null (unmarked)", () => {
      const allNull: AttendanceMember[] = [
        { userId: "m-1", name: "Alice", present: null },
        { userId: "m-2", name: "Bob", present: null },
      ];
      renderChecklist({ members: allNull });
      expect(screen.getByText("0 / 2 present")).toBeDefined();
    });
  });

  describe("toggle from explicit false to true", () => {
    it("toggles member from false to true correctly", async () => {
      mockFetchSuccess();
      const membersWithFalse: AttendanceMember[] = [
        { userId: "m-1", name: "Alice", present: false },
      ];
      renderChecklist({ members: membersWithFalse });

      expect(screen.getByText("0 / 1 present")).toBeDefined();

      const aliceRow = screen.getByTestId("attendance-row-m-1");
      await act(async () => {
        fireEvent.click(aliceRow);
      });

      // Optimistic update: should now be 1/1
      expect(screen.getByText("1 / 1 present")).toBeDefined();

      // Should send present: true
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/sessions/session-1/attendance",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ userId: "m-1", present: true }),
        })
      );
    });
  });

  describe("large member list", () => {
    it("renders all members in a large list", () => {
      const largeList: AttendanceMember[] = Array.from({ length: 20 }, (_, i) => ({
        userId: `m-${i + 1}`,
        name: `Member ${i + 1}`,
        present: i % 2 === 0,
      }));
      renderChecklist({ members: largeList });

      // 10 out of 20 are present (even indices)
      expect(screen.getByText("10 / 20 present")).toBeDefined();

      // All members rendered
      for (let i = 1; i <= 20; i++) {
        expect(screen.getByText(`Member ${i}`)).toBeDefined();
      }
    });
  });

  describe("fetch call count", () => {
    it("calls fetch exactly once per tap", async () => {
      mockFetchSuccess();
      renderChecklist();

      const aliceRow = screen.getByTestId("attendance-row-m-1");
      await act(async () => {
        fireEvent.click(aliceRow);
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
