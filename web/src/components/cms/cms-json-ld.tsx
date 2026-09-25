import type { PublicCmsDocument } from "@/lib/cms";
import { seoAbsoluteUrl } from "@/lib/seo-schema";

export function CmsJsonLd({
  type,
  url,
  documents,
}: {
  type: "Article" | "FAQPage" | "NewsArticle";
  url: string;
  documents: PublicCmsDocument[];
}) {
  const absolute = url.startsWith("http") ? url : seoAbsoluteUrl(url);
  const data =
    type === "FAQPage"
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          url: absolute,
          mainEntity: documents.map((item) => ({
            "@type": "Question",
            name: item.title,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.body ?? item.excerpt ?? "",
            },
          })),
        }
      : {
          "@context": "https://schema.org",
          "@type": type,
          headline: documents[0]?.title,
          description: documents[0]?.excerpt ?? documents[0]?.seoDescription,
          url: absolute,
          datePublished: documents[0]?.publishedAt,
        };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
