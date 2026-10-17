import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.BUZZ_TEST === "1" ? ".next-test" : ".next",
  serverExternalPackages: ["playwright", "bwip-js", "@sparticuz/chromium"],
  // Files read at runtime that static tracing cannot see.
  outputFileTracingIncludes: {
    "/api/**": [
      "./node_modules/@sparticuz/chromium/bin/**",
      // Playwright reads browsers.json and other files by computed paths.
      "./node_modules/playwright/**",
      "./node_modules/playwright-core/**",
      "./public/fonts/**",
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        source: "/api/(.*)",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};
export default config;
