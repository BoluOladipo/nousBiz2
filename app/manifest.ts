import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "NousBiz",
    short_name: "NousBiz",
    description: "Business management by Nous Technology Limited.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0c1936",
    theme_color: "#0c1936",
    icons: [
      {
        src: "/icons/nousbiz-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/nousbiz-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/nousbiz-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
