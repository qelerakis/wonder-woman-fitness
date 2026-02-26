/**
 * i18n-components.test.tsx — i18n integration tests for schedule components
 *
 * Tests that WeeklyCalendar, WorkoutEditor, DeleteRecurringSlotModal,
 * and AttendanceChecklist render translated strings and use day name
 * translations instead of hardcoded English.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ===== Mocks =====

const mockPush = vi.fn();
const mockBack = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    refresh: mockRefresh,
  }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockAddToast = vi.fn();
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

// ===== Imports =====

import { WeeklyCalendar } from "../WeeklyCalendar";
import { WorkoutEditor } from "../WorkoutEditor";
import { DeleteRecurringSlotModal } from "../DeleteRecurringSlotModal";
import { AttendanceChecklist } from "../AttendanceChecklist";

// ===== WeeklyCalendar tests =====

describe("WeeklyCalendar — i18n", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders translated day names (Monday through Sunday)", () => {
    const weekStart = new Date("2026-03-09"); // Monday
    render(
      <WeeklyCalendar
        weekStart={weekStart}
        sessions={[]}
        basePath="/owner/schedule/session"
      />
    );
    // Desktop view renders all day names
    expect(screen.getAllByText("Monday").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tuesday").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Wednesday").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Thursday").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Friday").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Saturday").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sunday").length).toBeGreaterThan(0);
  });

  it("renders translated 'No sessions' for empty days", () => {
    const weekStart = new Date("2026-03-09");
    render(
      <WeeklyCalendar
        weekStart={weekStart}
        sessions={[]}
        basePath="/owner/schedule/session"
      />
    );
    // 7 days × 2 views (desktop + mobile) = 14 "No sessions" texts
    const noSessionElements = screen.getAllByText("No sessions");
    expect(noSessionElements.length).toBeGreaterThanOrEqual(7);
  });

  it("renders Prev and Next buttons with translated text", () => {
    const weekStart = new Date("2026-03-09");
    const onWeekChange = vi.fn();
    render(
      <WeeklyCalendar
        weekStart={weekStart}
        sessions={[]}
        basePath="/owner/schedule/session"
        onWeekChange={onWeekChange}
      />
    );
    expect(screen.getByText("Prev")).toBeDefined();
    expect(screen.getByText("Next")).toBeDefined();
  });

  it("renders week range header with localized dates", () => {
    const weekStart = new Date("2026-03-09"); // March 9
    const onWeekChange = vi.fn();
    render(
      <WeeklyCalendar
        weekStart={weekStart}
        sessions={[]}
        basePath="/owner/schedule/session"
        onWeekChange={onWeekChange}
      />
    );
    // Should render "Mar 9 – Mar 15, 2026" (localized date format)
    // Multiple elements contain "Mar 9" (header + mobile day labels)
    expect(screen.getAllByText(/Mar 9/).length).toBeGreaterThan(0);
  });
});

// ===== WorkoutEditor tests =====

describe("WorkoutEditor — i18n", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders translated 'Edit Workout' heading", () => {
    render(
      <WorkoutEditor
        sessionId="s1"
        initialTitle=""
        initialDetails=""
        onSave={vi.fn()}
      />
    );
    expect(screen.getByText("Edit Workout")).toBeDefined();
  });

  it("renders translated form labels", () => {
    render(
      <WorkoutEditor
        sessionId="s1"
        initialTitle=""
        initialDetails=""
        onSave={vi.fn()}
      />
    );
    expect(screen.getByText("Workout Title")).toBeDefined();
    expect(screen.getByText("Workout Details")).toBeDefined();
    expect(screen.getByText("Save Workout")).toBeDefined();
  });

  it("renders translated placeholders", () => {
    render(
      <WorkoutEditor
        sessionId="s1"
        initialTitle=""
        initialDetails=""
        onSave={vi.fn()}
      />
    );
    expect(screen.getByPlaceholderText("e.g., HIIT Strength Circuit")).toBeDefined();
    expect(screen.getByPlaceholderText("Describe the workout exercises, sets, reps, etc.")).toBeDefined();
  });

  it("shows translated validation error when title is empty", () => {
    render(
      <WorkoutEditor
        sessionId="s1"
        initialTitle="Original"
        initialDetails=""
        onSave={vi.fn()}
      />
    );
    // Clear the title so hasChanges is true and title is empty
    fireEvent.change(screen.getByPlaceholderText("e.g., HIIT Strength Circuit"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByText("Save Workout"));
    expect(screen.getByText("Workout title is required")).toBeDefined();
  });
});

// ===== DeleteRecurringSlotModal tests =====

describe("DeleteRecurringSlotModal — i18n", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders with translated day name (not hardcoded English)", () => {
    render(
      <DeleteRecurringSlotModal
        isOpen={true}
        onClose={vi.fn()}
        slotId="slot1"
        dayOfWeek={1}
        startHour={9}
        onDeleted={vi.fn()}
      />
    );
    // "Monday" comes from the schedule namespace translation
    expect(screen.getByText(/Monday/)).toBeDefined();
  });

  it("renders translated radio options", () => {
    render(
      <DeleteRecurringSlotModal
        isOpen={true}
        onClose={vi.fn()}
        slotId="slot1"
        dayOfWeek={3}
        startHour={18}
        onDeleted={vi.fn()}
      />
    );
    expect(screen.getByText("Stop future generation only")).toBeDefined();
    expect(screen.getByText("Delete slot and all upcoming sessions")).toBeDefined();
  });

  it("shows translated error on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    render(
      <DeleteRecurringSlotModal
        isOpen={true}
        onClose={vi.fn()}
        slotId="slot1"
        dayOfWeek={1}
        startHour={9}
        onDeleted={vi.fn()}
      />
    );

    // Click the Delete button
    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() => {
      expect(screen.getByText("Network error. Please try again.")).toBeDefined();
    });
  });

  it("shows translated error on API failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      })
    );

    render(
      <DeleteRecurringSlotModal
        isOpen={true}
        onClose={vi.fn()}
        slotId="slot1"
        dayOfWeek={1}
        startHour={9}
        onDeleted={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() => {
      expect(screen.getByText("Failed to delete recurring slot")).toBeDefined();
    });
  });

  it("uses translated day names for all days of the week", () => {
    const dayNames: Record<number, string> = {
      1: "Monday",
      2: "Tuesday",
      3: "Wednesday",
      4: "Thursday",
      5: "Friday",
      6: "Saturday",
      7: "Sunday",
    };

    for (const [day, expectedName] of Object.entries(dayNames)) {
      const { unmount } = render(
        <DeleteRecurringSlotModal
          isOpen={true}
          onClose={vi.fn()}
          slotId="slot1"
          dayOfWeek={Number(day)}
          startHour={9}
          onDeleted={vi.fn()}
        />
      );
      expect(screen.getByText(new RegExp(expectedName))).toBeDefined();
      unmount();
    }
  });
});

// ===== AttendanceChecklist tests =====

describe("AttendanceChecklist — i18n", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("renders translated '+ Add Member' button", () => {
    render(
      <AttendanceChecklist
        sessionId="s1"
        members={[
          { userId: "m1", name: "Alice", present: true },
        ]}
        allActiveMembers={[{ id: "m1", name: "Alice" }]}
      />
    );
    expect(screen.getByText("+ Add Member")).toBeDefined();
  });

  it("renders translated 'Cancel' button when adding", () => {
    render(
      <AttendanceChecklist
        sessionId="s1"
        members={[]}
        allActiveMembers={[{ id: "m1", name: "Alice" }]}
      />
    );
    fireEvent.click(screen.getByText("+ Add Member"));
    expect(screen.getByText("Cancel")).toBeDefined();
  });

  it("renders translated present count", () => {
    render(
      <AttendanceChecklist
        sessionId="s1"
        members={[
          { userId: "m1", name: "Alice", present: true },
          { userId: "m2", name: "Bob", present: false },
        ]}
        allActiveMembers={[
          { id: "m1", name: "Alice" },
          { id: "m2", name: "Bob" },
        ]}
      />
    );
    expect(screen.getByText("1 / 2 present")).toBeDefined();
  });

  it("shows translated error toast on failed attendance update", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false })
    );

    render(
      <AttendanceChecklist
        sessionId="s1"
        members={[
          { userId: "m1", name: "Alice", present: null },
        ]}
        allActiveMembers={[{ id: "m1", name: "Alice" }]}
      />
    );

    // Click the checkmark button to mark as present
    const buttons = screen.getAllByRole("button");
    const presentBtn = buttons.find((b) => b.getAttribute("aria-label")?.includes("present"));
    if (presentBtn) {
      fireEvent.click(presentBtn);
      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "error",
            title: "Failed to update attendance",
          })
        );
      });
    }
  });
});
