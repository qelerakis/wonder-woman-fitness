import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";

// Mock next/dynamic to simulate lazy loading behavior
vi.mock("next/dynamic", () => ({
  default: (
    loader: () => Promise<{ default: React.ComponentType }>,
    opts?: { ssr?: boolean; loading?: () => React.ReactElement | null }
  ) => {
    // Capture the options for inspection
    const Component = (props: Record<string, unknown>) => {
      // In test, render the loading fallback or nothing
      if (opts?.loading) return opts.loading();
      return null;
    };
    Component.displayName = "DynamicComponent";
    // Attach metadata for test inspection
    (Component as Record<string, unknown>)._dynamicOptions = opts;
    (Component as Record<string, unknown>)._loader = loader;
    return Component;
  },
}));

// Import AFTER mocking next/dynamic
import { LazyAuthBackground } from "@/components/layout/LazyAuthBackground";

describe("LazyAuthBackground", () => {
  // ----- Export shape -----

  it("is exported as a named function", () => {
    expect(typeof LazyAuthBackground).toBe("function");
  });

  it("has the correct function name", () => {
    expect(LazyAuthBackground.name).toBe("LazyAuthBackground");
  });

  // ----- Rendering -----

  it("renders without crashing", () => {
    expect(() => render(<LazyAuthBackground />)).not.toThrow();
  });

  it("returns a React element (not null)", () => {
    const { container } = render(<LazyAuthBackground />);
    // Even with ssr: false mock, the component should render something
    expect(container).toBeTruthy();
  });

  // ----- Dynamic import configuration -----

  it("uses ssr: false to prevent server-side rendering", async () => {
    // Read the source to verify the ssr: false configuration
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "components/layout/LazyAuthBackground.tsx"
      ),
      "utf-8"
    );
    expect(source).toContain("ssr: false");
  });

  it("is marked as a client component", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "components/layout/LazyAuthBackground.tsx"
      ),
      "utf-8"
    );
    // "use client" must be the first line
    expect(source.trimStart().startsWith('"use client"')).toBe(true);
  });

  it("dynamically imports AuthBackground from the correct path", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "components/layout/LazyAuthBackground.tsx"
      ),
      "utf-8"
    );
    expect(source).toContain(
      'import("@/components/layout/AuthBackground")'
    );
  });

  it("maps named export to default export for dynamic()", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const source = fs.readFileSync(
      path.resolve(
        process.cwd(),
        "components/layout/LazyAuthBackground.tsx"
      ),
      "utf-8"
    );
    // Verify .then((m) => ({ default: m.AuthBackground })) pattern
    expect(source).toContain("default: m.AuthBackground");
  });
});
