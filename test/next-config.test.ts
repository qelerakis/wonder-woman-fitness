import { describe, it, expect } from "vitest";

describe("next.config.ts", () => {
  it("includes optimizePackageImports for tree-shaking", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const configContent = fs.readFileSync(
      path.resolve(process.cwd(), "next.config.ts"),
      "utf-8"
    );

    expect(configContent).toContain("optimizePackageImports");
    expect(configContent).toContain("date-fns");
    expect(configContent).toContain("recharts");
  });

  it("keeps serverExternalPackages unchanged", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const configContent = fs.readFileSync(
      path.resolve(process.cwd(), "next.config.ts"),
      "utf-8"
    );

    expect(configContent).toContain("@prisma/client");
    expect(configContent).toContain("@prisma/adapter-pg");
    expect(configContent).toContain("bcrypt");
  });
});
