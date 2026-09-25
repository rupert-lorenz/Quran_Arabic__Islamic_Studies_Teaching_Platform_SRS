import type { Metadata } from "next";
import type { PublicCmsDocument } from "@/lib/cms";
import { getConfig } from "@/server/config";
import { getSiteSeo } from "@/server/seo/site";

function robotsFor(index: boolean): NonNullable<Metadata["robots"]> {
  return index
    ? { index: true, follow: true }
    : { index: false, follow: false };
}

async function withSiteIndex(index?: boolean) {
  const site = await getSiteSeo();
  return (index ?? true) && site.robotsIndex;
}

export async function cmsMetadata(
  document: PublicCmsDocument,
  path: string,
  options?: { index?: boolean },
): Promise<Metadata> {
  const title = document.seoTitle || document.title;
  const description = document.seoDescription || document.excerpt || undefined;
  const canonical = new URL(path, getConfig().APP_URL).toString();
  const ogType = document.type === "article" ? "article" : "website";
  const index = await withSiteIndex(options?.index);
  return {
    title,
    description,
    alternates: { canonical },
    robots: robotsFor(index),
    openGraph: {
      title,
      description,
      url: canonical,
      type: ogType,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export async function pageMetadata(input: {
  title: string;
  description?: string;
  path: string;
  ogType?: "website" | "article" | "profile";
  index?: boolean;
}): Promise<Metadata> {
  const canonical = new URL(input.path, getConfig().APP_URL).toString();
  const index = await withSiteIndex(input.index);
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical },
    robots: robotsFor(index),
    openGraph: {
      title: input.title,
      description: input.description,
      url: canonical,
      type: input.ogType ?? "website",
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
    },
  };
}
