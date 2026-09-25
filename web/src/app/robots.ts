import type { MetadataRoute } from "next";
import {
  AUTH_DISALLOW_PATHS,
  PRIVATE_DISALLOW_PATHS,
} from "@/lib/seo";
import { getConfig } from "@/server/config";
import { getSiteSeo } from "@/server/seo/site";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = getConfig().APP_URL.replace(/\/$/, "");
  const seo = await getSiteSeo();
  if (!seo.robotsIndex) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...PRIVATE_DISALLOW_PATHS, ...AUTH_DISALLOW_PATHS],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
