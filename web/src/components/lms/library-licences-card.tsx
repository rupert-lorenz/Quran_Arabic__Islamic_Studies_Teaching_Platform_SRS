"use client";

import { useT } from "@/components/i18n/i18n-provider";
import { LibraryExpiryLabel } from "@/components/lms/library-expiry-label";
import type { LearnerLicenceView } from "@/server/lms/licences";

export function LibraryLicencesCard({
  licences,
}: {
  licences: LearnerLicenceView[];
}) {
  const t = useT();
  if (!licences.length) return null;

  return (
    <section className="mb-6 rounded-2xl border border-line bg-surface p-4">
      <h3 className="font-heading text-lg font-bold tracking-tight text-brand">
        {t("library.licence.yours")}
      </h3>
      <ul className="mt-3 grid gap-2">
        {licences.map((item) => (
          <li
            key={`${item.poolKey}-${item.materialTitle ?? "pool"}-${item.expiresAt ?? "open"}`}
            className="text-sm font-semibold text-muted"
          >
            {item.poolName}
            {item.materialTitle ? ` · ${item.materialTitle}` : ` · ${t("library.licence.whole_pool")}`}
            {` · `}
            <LibraryExpiryLabel expiresAt={item.expiresAt} />
          </li>
        ))}
      </ul>
    </section>
  );
}
