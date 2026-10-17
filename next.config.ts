import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.BUZZ_TEST === "1" ? ".next-test" : ".next",
  serverExternalPackages: ["playwright", "bwip-js"],
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
