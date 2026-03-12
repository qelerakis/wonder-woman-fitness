import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wonder Woman Fitness",
    short_name: "WW Fitness",
    description: "Studio management platform for Wonder Woman Fitness",
    start_url: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#9333ea",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
