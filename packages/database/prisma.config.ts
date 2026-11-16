import { defineConfig } from "prisma/config";
import { loadEnvFile } from "node:process";
import { resolve } from "node:path";
try {
  loadEnvFile(resolve(__dirname, "../../.env"));
} catch {
  /* CI uses environment variables. */
}
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://localhost:5432/menenwbkam",
  },
});
