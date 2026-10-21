import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "BUZZ · Internal transfers",
  description: "MEHDI ALI TRADING Co. internal inventory transfer management",
  manifest: "/manifest.webmanifest",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
