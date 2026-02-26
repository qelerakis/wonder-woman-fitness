import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageToggle } from "../LanguageToggle";

// Override the global mock for useLocale to return "mk"
vi.mock("next-intl", async () => {
  const actual = await vi.importActual("next-intl");
  return {
    ...actual,
    useLocale: () => "mk",
  };
});

describe("LanguageToggle", () => {
  let mockReload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = "NEXT_LOCALE=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    mockReload = vi.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: mockReload },
      writable: true,
    });
  });

  it("renders MK and EN buttons", () => {
    render(<LanguageToggle />);
    expect(screen.getByText("\u041C\u041A")).toBeTruthy();
    expect(screen.getByText("EN")).toBeTruthy();
  });

  it("highlights the current locale (mk)", () => {
    render(<LanguageToggle />);
    const mkButton = screen.getByText("\u041C\u041A");
    expect(mkButton.className).toContain("bg-primary-600");
  });

  it("switches to English when EN is clicked", () => {
    render(<LanguageToggle />);
    fireEvent.click(screen.getByText("EN"));
    expect(document.cookie).toContain("NEXT_LOCALE=en");
    expect(mockReload).toHaveBeenCalled();
  });

  it("does not reload when clicking the already-active locale", () => {
    render(<LanguageToggle />);
    fireEvent.click(screen.getByText("\u041C\u041A"));
    expect(mockReload).not.toHaveBeenCalled();
  });

  it("has correct aria-labels", () => {
    render(<LanguageToggle />);
    expect(screen.getByLabelText("Switch to Macedonian")).toBeTruthy();
    expect(screen.getByLabelText("Switch to English")).toBeTruthy();
  });
});
