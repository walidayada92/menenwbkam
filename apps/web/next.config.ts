import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";
import { loadEnvFile } from "node:process";
import { resolve } from "node:path";
try {
  loadEnvFile(resolve(process.cwd(), "../../.env"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
const nextConfig: NextConfig = {
  // Keep verification builds from replacing the running development server's chunks.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default withNextIntl(nextConfig);
