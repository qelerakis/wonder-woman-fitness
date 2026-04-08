import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Loading from "@/app/(auth)/loading";

describe("Auth Loading", () => {
  // ----- Rendering -----

  it("renders without crashing", () => {
    const { container } = render(<Loading />);
    expect(container.firstElementChild).toBeTruthy();
  });

  it("renders a single animated spinner element", () => {
    render(<Loading />);
    const spinners = document.querySelectorAll(".animate-spin");
    expect(spinners).toHaveLength(1);
  });

  it("exports as default function", () => {
    expect(typeof Loading).toBe("function");
    expect(Loading.name).toBe("Loading");
  });

  // ----- Container Layout -----

  it("centers spinner with flexbox", () => {
    const { container } = render(<Loading />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("flex");
    expect(wrapper.className).toContain("items-center");
    expect(wrapper.className).toContain("justify-center");
  });

  it("has h-64 height for vertical spacing", () => {
    const { container } = render(<Loading />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("h-64");
  });

  it("has exactly two nested elements (container > spinner)", () => {
    const { container } = render(<Loading />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.children).toHaveLength(1);
    expect(wrapper.children[0].children).toHaveLength(0);
  });

  // ----- Spinner Styling -----

  it("uses brand color border-primary-400 for spinner", () => {
    render(<Loading />);
    const spinner = document.querySelector(".animate-spin") as HTMLElement;
    expect(spinner.className).toContain("border-primary-400");
  });

  it("has transparent top border for spinning effect", () => {
    render(<Loading />);
    const spinner = document.querySelector(".animate-spin") as HTMLElement;
    expect(spinner.className).toContain("border-t-transparent");
  });

  it("uses border-2 for visible spinner thickness", () => {
    render(<Loading />);
    const spinner = document.querySelector(".animate-spin") as HTMLElement;
    expect(spinner.className).toContain("border-2");
  });

  it("uses rounded-full for circular shape", () => {
    render(<Loading />);
    const spinner = document.querySelector(".animate-spin") as HTMLElement;
    expect(spinner.className).toContain("rounded-full");
  });

  it("has h-8 w-8 dimensions for spinner size", () => {
    render(<Loading />);
    const spinner = document.querySelector(".animate-spin") as HTMLElement;
    expect(spinner.className).toContain("h-8");
    expect(spinner.className).toContain("w-8");
  });

  // ----- Consistency with Other Route Groups -----

  it("matches the member loading component structure", async () => {
    const MemberLoading = (await import("@/app/(member)/loading")).default;
    const { container: authContainer } = render(<Loading />);
    const { container: memberContainer } = render(<MemberLoading />);

    const authHTML = authContainer.innerHTML;
    const memberHTML = memberContainer.innerHTML;
    expect(authHTML).toBe(memberHTML);
  });

  it("matches the owner loading component structure", async () => {
    const OwnerLoading = (await import("@/app/(owner)/loading")).default;
    const { container: authContainer } = render(<Loading />);
    const { container: ownerContainer } = render(<OwnerLoading />);

    const authHTML = authContainer.innerHTML;
    const ownerHTML = ownerContainer.innerHTML;
    expect(authHTML).toBe(ownerHTML);
  });

  it("matches the trainer loading component structure", async () => {
    const TrainerLoading = (await import("@/app/(trainer)/loading")).default;
    const { container: authContainer } = render(<Loading />);
    const { container: trainerContainer } = render(<TrainerLoading />);

    const authHTML = authContainer.innerHTML;
    const trainerHTML = trainerContainer.innerHTML;
    expect(authHTML).toBe(trainerHTML);
  });
});
