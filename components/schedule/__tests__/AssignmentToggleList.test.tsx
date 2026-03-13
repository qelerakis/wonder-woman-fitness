import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AssignmentToggleList } from "../AssignmentToggleList";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const strings: Record<string, string> = {
      assigned: "Assigned",
      add: "Add",
      noPeopleAvailable: "No people available.",
      searchPlaceholder: "Search members...",
      noSearchResults: "No members found.",
    };
    return strings[key] || key;
  },
}));

const mockPeople = [
  { id: "1", name: "Alice Johnson" },
  { id: "2", name: "Bob Smith" },
  { id: "3", name: "Charlie Brown" },
  { id: "4", name: "Diana Prince" },
  { id: "5", name: "Eve Adams" },
];

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    title: "Members",
    people: mockPeople,
    assignedIds: ["1"],
    onToggle: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ===== Tests =====

describe("AssignmentToggleList", () => {
  // ─── Core rendering (no search) ───────────────────────────────────

  describe("core rendering", () => {
    it("renders the title", () => {
      render(<AssignmentToggleList {...makeProps()} />);
      expect(screen.getByText("Members")).toBeDefined();
    });

    it("renders all people in the list", () => {
      render(<AssignmentToggleList {...makeProps()} />);
      for (const person of mockPeople) {
        expect(screen.getByText(person.name)).toBeDefined();
      }
    });

    it("shows 'Assigned' button for assigned people", () => {
      render(<AssignmentToggleList {...makeProps({ assignedIds: ["1", "3"] })} />);
      const assignedButtons = screen.getAllByText("Assigned");
      expect(assignedButtons).toHaveLength(2);
    });

    it("shows 'Add' button for unassigned people", () => {
      render(<AssignmentToggleList {...makeProps({ assignedIds: ["1"] })} />);
      const addButtons = screen.getAllByText("Add");
      expect(addButtons).toHaveLength(4); // 5 people - 1 assigned = 4
    });

    it("shows empty message when people list is empty", () => {
      render(<AssignmentToggleList {...makeProps({ people: [] })} />);
      expect(screen.getByText("No people available.")).toBeDefined();
    });

    it("displays capacity description when maxCapacity and currentCount provided", () => {
      render(
        <AssignmentToggleList
          {...makeProps({ maxCapacity: 30, currentCount: 12 })}
        />
      );
      expect(screen.getByText("12 / 30")).toBeDefined();
    });

    it("does not display capacity when maxCapacity not provided", () => {
      render(<AssignmentToggleList {...makeProps()} />);
      expect(screen.queryByText(/\d+ \/ \d+/)).toBeNull();
    });
  });

  // ─── Toggle behavior ──────────────────────────────────────────────

  describe("toggle behavior", () => {
    it("calls onToggle with (userId, false) when adding a member", async () => {
      const onToggle = vi.fn().mockResolvedValue(undefined);
      render(<AssignmentToggleList {...makeProps({ onToggle, assignedIds: [] })} />);

      const addButtons = screen.getAllByText("Add");
      fireEvent.click(addButtons[0]); // Alice

      await waitFor(() => {
        expect(onToggle).toHaveBeenCalledWith("1", false);
      });
    });

    it("calls onToggle with (userId, true) when removing an assigned member", async () => {
      const onToggle = vi.fn().mockResolvedValue(undefined);
      render(<AssignmentToggleList {...makeProps({ onToggle, assignedIds: ["2"] })} />);

      const assignedButton = screen.getByText("Assigned");
      fireEvent.click(assignedButton);

      await waitFor(() => {
        expect(onToggle).toHaveBeenCalledWith("2", true);
      });
    });

    it("shows loading spinner during toggle", async () => {
      let resolveToggle: () => void;
      const onToggle = vi.fn().mockImplementation(
        () => new Promise<void>((resolve) => { resolveToggle = resolve; })
      );
      render(<AssignmentToggleList {...makeProps({ onToggle, assignedIds: [] })} />);

      expect(screen.getAllByText("Add")).toHaveLength(5);

      const addButtons = screen.getAllByText("Add");
      fireEvent.click(addButtons[0]); // Alice

      // Spinner should appear — Alice's Add button replaced by spinner
      await waitFor(() => {
        expect(screen.getAllByText("Add")).toHaveLength(4);
      });

      // Resolve and spinner should disappear
      resolveToggle!();
      await waitFor(() => {
        expect(screen.getAllByText("Add")).toHaveLength(5);
      });
    });

    it("disables Add buttons when all toggles are disabled", () => {
      render(<AssignmentToggleList {...makeProps({ disabled: true, assignedIds: [] })} />);
      const addButtons = screen.getAllByText("Add");
      for (const btn of addButtons) {
        expect((btn as HTMLButtonElement).disabled).toBe(true);
      }
    });

    it("disables Assigned buttons when all toggles are disabled", () => {
      render(<AssignmentToggleList {...makeProps({ disabled: true, assignedIds: ["1", "2"] })} />);
      const assignedButtons = screen.getAllByText("Assigned");
      for (const btn of assignedButtons) {
        expect((btn as HTMLButtonElement).disabled).toBe(true);
      }
    });

    it("disables Add buttons when at capacity", () => {
      render(
        <AssignmentToggleList
          {...makeProps({ maxCapacity: 1, currentCount: 1, assignedIds: ["1"] })}
        />
      );
      // Unassigned people's Add buttons should be disabled
      const addButtons = screen.getAllByText("Add");
      for (const btn of addButtons) {
        expect((btn as HTMLButtonElement).disabled).toBe(true);
      }
    });

    it("does not disable Assigned button when at capacity (can still remove)", () => {
      render(
        <AssignmentToggleList
          {...makeProps({ maxCapacity: 1, currentCount: 1, assignedIds: ["1"] })}
        />
      );
      const assignedButton = screen.getByText("Assigned");
      expect((assignedButton as HTMLButtonElement).disabled).toBe(false);
    });
  });

  // ─── Search: visibility ───────────────────────────────────────────

  describe("search visibility", () => {
    it("does not render search input when showSearch is false", () => {
      render(<AssignmentToggleList {...makeProps({ showSearch: false })} />);
      expect(screen.queryByPlaceholderText("Search members...")).toBeNull();
    });

    it("does not render search input when showSearch is not provided", () => {
      render(<AssignmentToggleList {...makeProps()} />);
      expect(screen.queryByPlaceholderText("Search members...")).toBeNull();
    });

    it("renders search input when showSearch is true", () => {
      render(<AssignmentToggleList {...makeProps({ showSearch: true })} />);
      expect(screen.getByPlaceholderText("Search members...")).toBeDefined();
    });

    it("search input has aria-label for accessibility", () => {
      render(<AssignmentToggleList {...makeProps({ showSearch: true })} />);
      expect(screen.getByLabelText("Search members...")).toBeDefined();
    });

    it("search container has role='search'", () => {
      render(<AssignmentToggleList {...makeProps({ showSearch: true })} />);
      const searchContainer = screen.getByRole("search");
      expect(searchContainer).toBeDefined();
    });
  });

  // ─── Search: filtering ────────────────────────────────────────────

  describe("search filtering", () => {
    it("filters people by name (case-insensitive)", () => {
      render(<AssignmentToggleList {...makeProps({ showSearch: true })} />);
      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "ali" } });

      expect(screen.getByText("Alice Johnson")).toBeDefined();
      expect(screen.queryByText("Bob Smith")).toBeNull();
      expect(screen.queryByText("Charlie Brown")).toBeNull();
      expect(screen.queryByText("Diana Prince")).toBeNull();
      expect(screen.queryByText("Eve Adams")).toBeNull();
    });

    it("matches uppercase query against lowercase name", () => {
      render(<AssignmentToggleList {...makeProps({ showSearch: true })} />);
      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "ALICE" } });

      expect(screen.getByText("Alice Johnson")).toBeDefined();
      expect(screen.queryByText("Bob Smith")).toBeNull();
    });

    it("matches mixed case query", () => {
      render(<AssignmentToggleList {...makeProps({ showSearch: true })} />);
      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "aLiCe" } });

      expect(screen.getByText("Alice Johnson")).toBeDefined();
    });

    it("matches partial names anywhere in the string", () => {
      render(<AssignmentToggleList {...makeProps({ showSearch: true })} />);
      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "smith" } });

      expect(screen.getByText("Bob Smith")).toBeDefined();
      expect(screen.queryByText("Alice Johnson")).toBeNull();
    });

    it("matches middle of name", () => {
      render(<AssignmentToggleList {...makeProps({ showSearch: true })} />);
      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "ohnso" } }); // part of "Johnson"

      expect(screen.getByText("Alice Johnson")).toBeDefined();
      expect(screen.queryByText("Bob Smith")).toBeNull();
    });

    it("returns multiple matches when query matches several names", () => {
      // "a" appears in Alice, Charlie, Diana, Eve Adams
      render(<AssignmentToggleList {...makeProps({ showSearch: true })} />);
      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "a" } });

      expect(screen.getByText("Alice Johnson")).toBeDefined();
      expect(screen.getByText("Charlie Brown")).toBeDefined();
      expect(screen.getByText("Diana Prince")).toBeDefined();
      expect(screen.getByText("Eve Adams")).toBeDefined();
      expect(screen.queryByText("Bob Smith")).toBeNull(); // no "a" in "Bob Smith"
    });

    it("shows all people when search is empty", () => {
      render(<AssignmentToggleList {...makeProps({ showSearch: true })} />);
      const input = screen.getByPlaceholderText("Search members...");

      fireEvent.change(input, { target: { value: "ali" } });
      fireEvent.change(input, { target: { value: "" } });

      for (const person of mockPeople) {
        expect(screen.getByText(person.name)).toBeDefined();
      }
    });

    it("treats whitespace-only query as empty (shows all people)", () => {
      render(<AssignmentToggleList {...makeProps({ showSearch: true })} />);
      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "   " } });

      for (const person of mockPeople) {
        expect(screen.getByText(person.name)).toBeDefined();
      }
    });

    it("trims leading/trailing spaces from search query", () => {
      render(<AssignmentToggleList {...makeProps({ showSearch: true })} />);
      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "  alice  " } });

      expect(screen.getByText("Alice Johnson")).toBeDefined();
      expect(screen.queryByText("Bob Smith")).toBeNull();
    });

    it("shows no-results message when no names match", () => {
      render(<AssignmentToggleList {...makeProps({ showSearch: true })} />);
      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "zzzzz" } });

      expect(screen.getByText("No members found.")).toBeDefined();
      expect(screen.queryByText("Alice Johnson")).toBeNull();
    });

    it("shows 'no people available' (not 'no results') when list is empty without search", () => {
      render(
        <AssignmentToggleList
          {...makeProps({ people: [], showSearch: true })}
        />
      );
      expect(screen.getByText("No people available.")).toBeDefined();
      expect(screen.queryByText("No members found.")).toBeNull();
    });
  });

  // ─── Search: state preservation ───────────────────────────────────

  describe("search state preservation", () => {
    it("shows assigned members in filtered results with correct state", () => {
      render(<AssignmentToggleList {...makeProps({ showSearch: true })} />);
      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "alice" } });

      expect(screen.getByText("Alice Johnson")).toBeDefined();
      expect(screen.getByText("Assigned")).toBeDefined();
    });

    it("shows unassigned members in filtered results with Add button", () => {
      render(<AssignmentToggleList {...makeProps({ showSearch: true })} />);
      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "bob" } });

      expect(screen.getByText("Bob Smith")).toBeDefined();
      expect(screen.getByText("Add")).toBeDefined();
    });

    it("preserves toggle functionality on filtered results", async () => {
      const onToggle = vi.fn().mockResolvedValue(undefined);
      render(
        <AssignmentToggleList
          {...makeProps({ onToggle, showSearch: true })}
        />
      );
      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "bob" } });

      const addButton = screen.getByText("Add");
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(onToggle).toHaveBeenCalledWith("2", false);
      });
    });

    it("preserves remove toggle on filtered assigned members", async () => {
      const onToggle = vi.fn().mockResolvedValue(undefined);
      render(
        <AssignmentToggleList
          {...makeProps({ onToggle, showSearch: true })}
        />
      );
      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "alice" } });

      const assignedButton = screen.getByText("Assigned");
      fireEvent.click(assignedButton);

      await waitFor(() => {
        expect(onToggle).toHaveBeenCalledWith("1", true);
      });
    });

    it("preserves capacity display when searching", () => {
      render(
        <AssignmentToggleList
          {...makeProps({ showSearch: true, maxCapacity: 30, currentCount: 5 })}
        />
      );
      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "alice" } });

      expect(screen.getByText("5 / 30")).toBeDefined();
    });

    it("at-capacity state is preserved when searching", () => {
      render(
        <AssignmentToggleList
          {...makeProps({
            showSearch: true,
            maxCapacity: 1,
            currentCount: 1,
            assignedIds: ["1"],
          })}
        />
      );
      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "bob" } });

      // Bob is unassigned and we're at capacity, so Add should be disabled
      const addButton = screen.getByText("Add");
      expect((addButton as HTMLButtonElement).disabled).toBe(true);
    });
  });

  // ─── Search: disabled state ───────────────────────────────────────

  describe("search disabled state", () => {
    it("search input is disabled when component disabled is true", () => {
      render(
        <AssignmentToggleList
          {...makeProps({ showSearch: true, disabled: true })}
        />
      );
      const input = screen.getByPlaceholderText("Search members...");
      expect((input as HTMLInputElement).disabled).toBe(true);
    });

    it("search input is enabled when component disabled is false", () => {
      render(
        <AssignmentToggleList
          {...makeProps({ showSearch: true, disabled: false })}
        />
      );
      const input = screen.getByPlaceholderText("Search members...");
      expect((input as HTMLInputElement).disabled).toBe(false);
    });

    it("search input has disabled styling via Tailwind variants", () => {
      render(
        <AssignmentToggleList
          {...makeProps({ showSearch: true, disabled: true })}
        />
      );
      const input = screen.getByPlaceholderText("Search members...");
      expect(input.className).toContain("disabled:opacity-50");
      expect(input.className).toContain("disabled:cursor-not-allowed");
    });
  });

  // ─── Search: interaction during loading ───────────────────────────

  describe("search during loading", () => {
    it("can type in search while a toggle is in flight", async () => {
      let resolveToggle: () => void;
      const onToggle = vi.fn().mockImplementation(
        () => new Promise<void>((resolve) => { resolveToggle = resolve; })
      );
      render(
        <AssignmentToggleList
          {...makeProps({ onToggle, showSearch: true, assignedIds: [] })}
        />
      );

      // Start a toggle on Alice
      const addButtons = screen.getAllByText("Add");
      fireEvent.click(addButtons[0]); // Alice is now loading

      // While Alice is loading, search for Bob
      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "bob" } });

      // Bob should be visible, Alice should be filtered out
      expect(screen.getByText("Bob Smith")).toBeDefined();
      expect(screen.queryByText("Alice Johnson")).toBeNull();

      // Resolve the toggle
      resolveToggle!();
      await waitFor(() => {
        // After resolve, only Bob should still be visible (search still active)
        expect(screen.getByText("Bob Smith")).toBeDefined();
      });
    });

    it("loading spinner persists on correct person after search changes", async () => {
      let resolveToggle: () => void;
      const onToggle = vi.fn().mockImplementation(
        () => new Promise<void>((resolve) => { resolveToggle = resolve; })
      );
      // assignedIds: ["1"] means Alice is assigned (shows "Assigned" button)
      render(
        <AssignmentToggleList
          {...makeProps({ onToggle, showSearch: true })}
        />
      );

      // Filter to Bob, then start toggle
      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "bob" } });

      const addButton = screen.getByText("Add");
      fireEvent.click(addButton);

      // Bob should now be loading
      await waitFor(() => {
        expect(screen.queryByText("Add")).toBeNull(); // Bob's Add replaced by spinner
      });

      // Clear search to show all — Bob should still show spinner
      fireEvent.change(input, { target: { value: "" } });

      // Alice=Assigned, Bob=loading(spinner), Charlie/Diana/Eve = Add(3)
      expect(screen.getByText("Alice Johnson")).toBeDefined();
      expect(screen.getByText("Bob Smith")).toBeDefined();
      await waitFor(() => {
        expect(screen.getAllByText("Add")).toHaveLength(3);
      });

      resolveToggle!();
      await waitFor(() => {
        // After resolve, Bob should show Add button again
        expect(screen.getAllByText("Add")).toHaveLength(4);
      });
    });
  });

  // ─── Search: edge cases ───────────────────────────────────────────

  describe("search edge cases", () => {
    it("handles single character search", () => {
      render(<AssignmentToggleList {...makeProps({ showSearch: true })} />);
      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "e" } });

      // "e" appears in Alice, Charlie, Eve, Diana Prince
      expect(screen.getByText("Alice Johnson")).toBeDefined();
      expect(screen.getByText("Charlie Brown")).toBeDefined();
      expect(screen.getByText("Eve Adams")).toBeDefined();
      expect(screen.getByText("Diana Prince")).toBeDefined();
      expect(screen.queryByText("Bob Smith")).toBeNull();
    });

    it("handles special regex characters in search without crashing", () => {
      render(<AssignmentToggleList {...makeProps({ showSearch: true })} />);
      const input = screen.getByPlaceholderText("Search members...");

      // These should not crash — .includes() doesn't use regex
      fireEvent.change(input, { target: { value: ".*+" } });
      expect(screen.getByText("No members found.")).toBeDefined();

      fireEvent.change(input, { target: { value: "[abc]" } });
      expect(screen.getByText("No members found.")).toBeDefined();

      fireEvent.change(input, { target: { value: "(test)" } });
      expect(screen.getByText("No members found.")).toBeDefined();
    });

    it("handles very long search query gracefully", () => {
      render(<AssignmentToggleList {...makeProps({ showSearch: true })} />);
      const input = screen.getByPlaceholderText("Search members...");
      const longQuery = "a".repeat(500);
      fireEvent.change(input, { target: { value: longQuery } });

      expect(screen.getByText("No members found.")).toBeDefined();
    });

    it("search works with a single person in the list", () => {
      render(
        <AssignmentToggleList
          {...makeProps({
            people: [{ id: "1", name: "Alice Johnson" }],
            assignedIds: [],
            showSearch: true,
          })}
        />
      );
      const input = screen.getByPlaceholderText("Search members...");

      // Match
      fireEvent.change(input, { target: { value: "alice" } });
      expect(screen.getByText("Alice Johnson")).toBeDefined();

      // No match
      fireEvent.change(input, { target: { value: "bob" } });
      expect(screen.getByText("No members found.")).toBeDefined();
    });

    it("search works when all people are assigned", () => {
      render(
        <AssignmentToggleList
          {...makeProps({
            assignedIds: ["1", "2", "3", "4", "5"],
            showSearch: true,
          })}
        />
      );
      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "alice" } });

      expect(screen.getByText("Alice Johnson")).toBeDefined();
      expect(screen.getByText("Assigned")).toBeDefined();
    });

    it("rapid sequential searches settle on final query", () => {
      render(<AssignmentToggleList {...makeProps({ showSearch: true })} />);
      const input = screen.getByPlaceholderText("Search members...");

      fireEvent.change(input, { target: { value: "a" } });
      fireEvent.change(input, { target: { value: "al" } });
      fireEvent.change(input, { target: { value: "ali" } });
      fireEvent.change(input, { target: { value: "alic" } });
      fireEvent.change(input, { target: { value: "alice" } });

      expect(screen.getByText("Alice Johnson")).toBeDefined();
      expect(screen.queryByText("Bob Smith")).toBeNull();
    });

    it("shows 'no people available' when people=[] and search query is active", () => {
      render(
        <AssignmentToggleList
          {...makeProps({ people: [], showSearch: true })}
        />
      );
      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "alice" } });

      // Should show "no people available" NOT "no members found"
      // because the list is genuinely empty, not filtered to zero
      expect(screen.getByText("No people available.")).toBeDefined();
      expect(screen.queryByText("No members found.")).toBeNull();
    });

    it("reflects typed value in the input DOM element", () => {
      render(<AssignmentToggleList {...makeProps({ showSearch: true })} />);
      const input = screen.getByPlaceholderText("Search members...") as HTMLInputElement;

      fireEvent.change(input, { target: { value: "alice" } });
      expect(input.value).toBe("alice");

      fireEvent.change(input, { target: { value: "" } });
      expect(input.value).toBe("");
    });
  });

  // ─── Error handling ───────────────────────────────────────────────

  describe("error handling", () => {
    it("clears loading state when onToggle rejects", async () => {
      // Use mockImplementation to control the rejection timing and catch in test
      let rejectToggle: (err: Error) => void;
      const onToggle = vi.fn().mockImplementation(
        () => new Promise<void>((_resolve, reject) => { rejectToggle = reject; })
      );
      render(<AssignmentToggleList {...makeProps({ onToggle, assignedIds: [] })} />);

      const addButtons = screen.getAllByText("Add");
      fireEvent.click(addButtons[0]); // Alice

      // Spinner should appear
      await waitFor(() => {
        expect(screen.getAllByText("Add")).toHaveLength(4);
      });

      // Reject — the component's handleToggle uses try/finally so loadingId clears
      rejectToggle!(new Error("Network error"));

      // After rejection, spinner should disappear and button should return
      await waitFor(() => {
        expect(screen.getAllByText("Add")).toHaveLength(5);
      });
    });

    it("clears loading state when onToggle rejects during search", async () => {
      let rejectToggle: (err: Error) => void;
      const onToggle = vi.fn().mockImplementation(
        () => new Promise<void>((_resolve, reject) => { rejectToggle = reject; })
      );
      render(
        <AssignmentToggleList
          {...makeProps({ onToggle, assignedIds: [], showSearch: true })}
        />
      );

      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "bob" } });

      const addButton = screen.getByText("Add");
      fireEvent.click(addButton);

      // Spinner should appear (Bob's Add replaced)
      await waitFor(() => {
        expect(screen.queryByText("Add")).toBeNull();
      });

      // Reject
      rejectToggle!(new Error("Network error"));

      // After rejection, button should return
      await waitFor(() => {
        expect(screen.getByText("Add")).toBeDefined();
      });
    });
  });
});
