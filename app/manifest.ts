import type { MetadataRoute } from "next";

// Web App Manifest — makes Tuloy installable (home-screen icon, standalone window).
// Icons reuse the existing brand assets in /public/favicon. No offline/SW behavior here;
// installability only. Theme/background match the brand tokens in app/globals.css.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tuloy — San Juan, La Union stays",
    short_name: "Tuloy",
    description:
      "Discover, book, and pay for San Juan, La Union transients and hotels — live availability, no double-bookings.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7f5",
    theme_color: "#2c7a6b",
    icons: [
      {
        src: "/favicon/favicon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/favicon/tuloy-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
