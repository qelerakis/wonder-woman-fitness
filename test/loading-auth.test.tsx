import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Loading from "@/app/(auth)/loading";

describe("Auth Loading", () => {
  it("renders a loading spinner", () => {
    render(<Loading />);
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("has accessible centering container", () => {
    const { container } = render(<Loading />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("flex");
    expect(wrapper.className).toContain("items-center");
    expect(wrapper.className).toContain("justify-center");
  });

  it("uses brand color for spinner", () => {
    render(<Loading />);
    const spinner = document.querySelector(".animate-spin");
    expect(spinner?.className).toContain("border-primary-400");
  });
});
