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
if (process.env.VERCEL_ENV === "production") {
  if ((process.env.API_PROXY_SECRET?.length || 0) < 32)
    throw new Error(
      "Set a server-only API_PROXY_SECRET of at least 32 characters",
    );
  for (const name of ["API_URL", "NEXT_PUBLIC_SITE_URL"]) {
    const value = process.env[name];
    if (!value || new URL(value).protocol !== "https:")
      throw new Error(
        name + " must be configured as the production HTTPS origin",
      );
  }
}
const nextConfig: NextConfig = {
  output: "standalone",
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
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'" +
              (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "") +
              "; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' data:; connect-src 'self'" +
              (process.env.NODE_ENV === "development" ? " ws: wss:" : "") +
              "; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
};
export default withNextIntl(nextConfig);
