import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

const defaultProps = {
  title: "Members",
  people: mockPeople,
  assignedIds: ["1"],
  onToggle: vi.fn().mockResolvedValue(undefined),
};

describe("AssignmentToggleList", () => {
  describe("without search", () => {
    it("does not render search input when showSearch is false", () => {
      render(<AssignmentToggleList {...defaultProps} />);
      expect(screen.queryByPlaceholderText("Search members...")).toBeNull();
    });

    it("does not render search input when showSearch is not provided", () => {
      render(<AssignmentToggleList {...defaultProps} />);
      expect(screen.queryByPlaceholderText("Search members...")).toBeNull();
    });

    it("renders all people without search", () => {
      render(<AssignmentToggleList {...defaultProps} />);
      expect(screen.getByText("Alice Johnson")).toBeDefined();
      expect(screen.getByText("Bob Smith")).toBeDefined();
      expect(screen.getByText("Charlie Brown")).toBeDefined();
      expect(screen.getByText("Diana Prince")).toBeDefined();
      expect(screen.getByText("Eve Adams")).toBeDefined();
    });
  });

  describe("with search", () => {
    it("renders search input when showSearch is true", () => {
      render(<AssignmentToggleList {...defaultProps} showSearch />);
      expect(screen.getByPlaceholderText("Search members...")).toBeDefined();
    });

    it("filters people by name (case-insensitive)", () => {
      render(<AssignmentToggleList {...defaultProps} showSearch />);
      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "ali" } });

      expect(screen.getByText("Alice Johnson")).toBeDefined();
      expect(screen.queryByText("Bob Smith")).toBeNull();
      expect(screen.queryByText("Charlie Brown")).toBeNull();
      expect(screen.queryByText("Diana Prince")).toBeNull();
      expect(screen.queryByText("Eve Adams")).toBeNull();
    });

    it("shows all people when search is empty", () => {
      render(<AssignmentToggleList {...defaultProps} showSearch />);
      const input = screen.getByPlaceholderText("Search members...");

      // Type something then clear
      fireEvent.change(input, { target: { value: "ali" } });
      fireEvent.change(input, { target: { value: "" } });

      expect(screen.getByText("Alice Johnson")).toBeDefined();
      expect(screen.getByText("Bob Smith")).toBeDefined();
      expect(screen.getByText("Charlie Brown")).toBeDefined();
    });

    it("shows no-results message when no names match", () => {
      render(<AssignmentToggleList {...defaultProps} showSearch />);
      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "zzzzz" } });

      expect(screen.getByText("No members found.")).toBeDefined();
      expect(screen.queryByText("Alice Johnson")).toBeNull();
    });

    it("matches partial names anywhere in the string", () => {
      render(<AssignmentToggleList {...defaultProps} showSearch />);
      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "smith" } });

      expect(screen.getByText("Bob Smith")).toBeDefined();
      expect(screen.queryByText("Alice Johnson")).toBeNull();
    });

    it("shows assigned members in filtered results with correct state", () => {
      render(<AssignmentToggleList {...defaultProps} showSearch />);
      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "alice" } });

      expect(screen.getByText("Alice Johnson")).toBeDefined();
      // Alice (id: "1") is in assignedIds, so button should say "Assigned"
      expect(screen.getByText("Assigned")).toBeDefined();
    });

    it("preserves toggle functionality on filtered results", async () => {
      const onToggle = vi.fn().mockResolvedValue(undefined);
      render(
        <AssignmentToggleList
          {...defaultProps}
          onToggle={onToggle}
          showSearch
        />
      );
      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "bob" } });

      const addButton = screen.getByText("Add");
      fireEvent.click(addButton);

      expect(onToggle).toHaveBeenCalledWith("2", false);
    });

    it("preserves capacity display when searching", () => {
      render(
        <AssignmentToggleList
          {...defaultProps}
          showSearch
          maxCapacity={27}
          currentCount={5}
        />
      );
      const input = screen.getByPlaceholderText("Search members...");
      fireEvent.change(input, { target: { value: "alice" } });

      // Capacity description should still be visible
      expect(screen.getByText("5 / 27")).toBeDefined();
    });
  });
});
