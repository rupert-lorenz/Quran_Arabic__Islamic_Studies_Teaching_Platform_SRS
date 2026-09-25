import type { MetadataRoute } from "next";
import { listCmsSitemapEntries } from "@/server/cms/public";
import { getConfig } from "@/server/config";
import { listTranslatedSubjects } from "@/server/i18n/locale";
import { getSiteSeo } from "@/server/seo/site";
import { listPublicTeachers } from "@/server/teacher/public";

const staticPaths = [
  "/",
  "/teachers",
  "/subjects",
  "/courses",
  "/parents",
  "/teach",
  "/about",
  "/safeguarding",
  "/faq",
  "/blog",
  "/news",
  "/policies",
  "/pages",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const seo = await getSiteSeo();
  if (!seo.robotsIndex) {
    return [];
  }

  const base = getConfig().APP_URL.replace(/\/$/, "");
  const [cms, teachers, catalog] = await Promise.all([
    listCmsSitemapEntries().catch(() => []),
    listPublicTeachers().catch(() => []),
    listTranslatedSubjects().catch(() => []),
  ]);

  const seen = new Set<string>();
  const entries: MetadataRoute.Sitemap = [];

  function add(path: string, lastModified?: Date | string | null) {
    const url = path.startsWith("http") ? path : `${base}${path}`;
    if (seen.has(url)) {
      return;
    }
    seen.add(url);
    entries.push({
      url,
      lastModified: lastModified ? new Date(lastModified) : new Date(),
    });
  }

  for (const path of staticPaths) {
    add(path);
  }
  for (const item of cms) {
    add(item.href, item.publishedAt);
  }
  for (const teacher of teachers) {
    add(`/teachers/${teacher.userId}`);
  }
  for (const subject of catalog) {
    add(`/subjects/${subject.slug}`);
    add(`/courses/${subject.slug}`);
  }

  return entries;
}
