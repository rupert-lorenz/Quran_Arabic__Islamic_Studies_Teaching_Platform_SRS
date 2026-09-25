import type { BrandProfile } from "@/lib/brand";

export function BrandJsonLd({
  brand,
  url,
}: {
  brand: BrandProfile;
  url: string;
}) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brand.name,
    alternateName: brand.nameAr,
    legalName: brand.legalName,
    description: brand.description,
    url,
    email: brand.supportEmail,
    slogan: brand.tagline,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
