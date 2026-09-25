import type { MetadataRoute } from "next";
import { getBrand } from "@/server/brand";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const brand = await getBrand();

  return {
    name: brand.name,
    short_name: brand.shortName,
    description: brand.description,
    start_url: "/",
    display: "standalone",
    background_color: brand.colors.background,
    theme_color: brand.colors.primary,
    lang: "en",
    dir: "auto",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
