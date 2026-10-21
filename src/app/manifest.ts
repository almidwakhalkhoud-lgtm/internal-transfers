import type { MetadataRoute } from "next";
// Lets the site be added to a phone's home screen, which iPhones require
// before they deliver push notifications.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BUZZ · Internal transfers",
    short_name: "BUZZ",
    start_url: "/notifications",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#a32688",
    icons: [{ src: "/logo.jpeg", sizes: "any", type: "image/jpeg" }],
  };
}
