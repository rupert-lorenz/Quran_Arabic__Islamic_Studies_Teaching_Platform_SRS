import Link from "next/link";
import { Container } from "@/components/ui/container";
import type { PublicCmsDocument } from "@/lib/cms";

export function SiteBanner({
  banners,
  fallbackLabel,
  regionLabel,
}: {
  banners: PublicCmsDocument[];
  fallbackLabel: string;
  regionLabel: string;
}) {
  if (banners.length === 0) {
    return null;
  }

  const items = banners.slice(0, 2);

  return (
    <div
      className="border-b border-line bg-gold/55"
      role="region"
      aria-label={regionLabel}
    >
      <Container className="flex flex-col gap-3 py-2.5 lg:flex-row lg:items-center lg:gap-10">
        {items.map((banner) => {
          const href = banner.ctaHref || banner.href || "/";
          return (
            <div key={banner.id} className="flex min-w-0 flex-1 items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold leading-snug text-brand">
                  {banner.title}
                </p>
                {banner.excerpt ? (
                  <p className="text-xs font-medium leading-snug text-brand/75">
                    {banner.excerpt}
                  </p>
                ) : null}
              </div>
              <Link
                href={href}
                className="inline-flex min-h-11 shrink-0 items-center text-sm font-extrabold whitespace-nowrap text-brand hover:underline"
              >
                {banner.ctaLabel || fallbackLabel}
              </Link>
            </div>
          );
        })}
      </Container>
    </div>
  );
}
