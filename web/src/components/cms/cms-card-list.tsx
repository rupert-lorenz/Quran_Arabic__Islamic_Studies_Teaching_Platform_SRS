import Link from "next/link";
import type { PublicCmsDocument } from "@/lib/cms";

export function CmsCardList({
  items,
  empty,
  readLabel,
}: {
  items: PublicCmsDocument[];
  empty: string;
  readLabel: string;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-[2rem] bg-gold px-5 py-4 font-semibold text-brand">
        {empty}
      </p>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {items.map((item) => (
        <article
          key={item.id}
          className="rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
        >
          <h2 className="text-xl font-extrabold text-brand">{item.title}</h2>
          {item.excerpt ? <p className="mt-3 text-muted">{item.excerpt}</p> : null}
          <p className="mt-5">
            <Link
              href={item.href ?? "#"}
              className="font-bold text-brand underline"
            >
              {readLabel}
            </Link>
          </p>
        </article>
      ))}
    </div>
  );
}
