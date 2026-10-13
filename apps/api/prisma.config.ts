import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "prisma/config";

const packageDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: [resolve(packageDir, "../../.env"), resolve(packageDir, ".env")], quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  // Client generation runs during image builds, before runtime secrets exist.
  ...(process.env.DATABASE_URL ? { datasource: { url: process.env.DATABASE_URL } } : {}),
});
