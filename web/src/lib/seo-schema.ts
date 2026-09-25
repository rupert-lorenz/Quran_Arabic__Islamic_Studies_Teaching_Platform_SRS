import { getConfig } from "@/server/config";

export function seoAbsoluteUrl(path: string) {
  return new URL(path, getConfig().APP_URL).toString();
}

export function breadcrumbListJsonLd(
  items: { name: string; href?: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.href ? { item: seoAbsoluteUrl(item.href) } : {}),
    })),
  };
}

export function webPageJsonLd(input: {
  name: string;
  description?: string | null;
  path: string;
  type?: "WebPage" | "CollectionPage" | "ProfilePage" | "AboutPage";
}) {
  return {
    "@context": "https://schema.org",
    "@type": input.type ?? "WebPage",
    name: input.name,
    description: input.description || undefined,
    url: seoAbsoluteUrl(input.path),
  };
}

export function itemListJsonLd(
  path: string,
  items: { name: string; href: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    url: seoAbsoluteUrl(path),
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: seoAbsoluteUrl(item.href),
    })),
  };
}

export function teacherPersonJsonLd(input: {
  name: string;
  path: string;
  description?: string | null;
  countryName?: string | null;
  languages?: string | null;
  subjects: { name: string }[];
  rating?: number | null;
  reviewCount?: number;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: input.name,
    url: seoAbsoluteUrl(input.path),
    jobTitle: "Teacher",
    description: input.description || undefined,
    knowsAbout: input.subjects.map((item) => item.name).filter(Boolean),
    knowsLanguage: (input.languages ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    ...(input.countryName
      ? {
          address: {
            "@type": "PostalAddress",
            addressCountry: input.countryName,
          },
        }
      : {}),
    ...(input.rating && input.reviewCount
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(input.rating.toFixed(2)),
            reviewCount: input.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}

export function courseJsonLd(input: {
  name: string;
  description?: string | null;
  path: string;
  providerName: string;
  providerUrl: string;
  teachers: { name: string; href: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: input.name,
    description: input.description || undefined,
    url: seoAbsoluteUrl(input.path),
    provider: {
      "@type": "Organization",
      name: input.providerName,
      url: input.providerUrl,
    },
    isAccessibleForFree: false,
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "online",
      instructor: input.teachers.map((teacher) => ({
        "@type": "Person",
        name: teacher.name,
        url: seoAbsoluteUrl(teacher.href),
      })),
    },
  };
}

export function webSiteJsonLd(input: {
  name: string;
  description?: string | null;
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: input.name,
    description: input.description || undefined,
    url: input.url,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${input.url.replace(/\/$/, "")}/teachers?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}
