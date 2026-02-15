import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    path: "./prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    // Use process.env with fallback so prisma generate works without DATABASE_URL
    url: process.env.DATABASE_URL ?? "",
  },
});
