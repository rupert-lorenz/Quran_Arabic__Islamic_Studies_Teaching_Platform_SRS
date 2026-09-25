import Link from "next/link";
import { breadcrumbListJsonLd } from "@/lib/seo-schema";
import { SeoJsonLd } from "./seo-json-ld";

export type BreadcrumbItem = {
  href?: string;
  label: string;
};

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <SeoJsonLd
        data={breadcrumbListJsonLd(
          items.map((item) => ({ name: item.label, href: item.href })),
        )}
      />
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-brand-soft">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {index > 0 ? <span aria-hidden="true">/</span> : null}
              {item.href && !last ? (
                <Link href={item.href} className="underline-offset-2 hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span className={last ? "text-brand" : undefined} aria-current={last ? "page" : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
