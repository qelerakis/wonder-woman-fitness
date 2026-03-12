import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "../Footer";

describe("Footer", () => {
  it("renders the credit text", () => {
    render(<Footer />);
    expect(screen.getByText("Made by Stefan Savevski")).toBeInTheDocument();
  });

  it("renders inside a footer element", () => {
    render(<Footer />);
    const footer = screen.getByRole("contentinfo");
    expect(footer).toBeInTheDocument();
  });

  it("contains the credit text inside the footer element", () => {
    render(<Footer />);
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent("Made by Stefan Savevski");
  });
});
