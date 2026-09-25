"use client";

import { useT } from "@/components/i18n/i18n-provider";
import { LibraryExpiryLabel } from "@/components/lms/library-expiry-label";
import type { LearnerRentalView } from "@/server/lms/rentals";

export function LibraryRentalsCard({
  rentals,
}: {
  rentals: LearnerRentalView[];
}) {
  const t = useT();
  if (!rentals.length) return null;

  return (
    <section className="mb-6 rounded-2xl border border-line bg-surface p-4">
      <h3 className="font-heading text-lg font-bold tracking-tight text-brand">
        {t("library.rental.yours")}
      </h3>
      <ul className="mt-3 grid gap-2">
        {rentals.map((item) => (
          <li
            key={`${item.materialId}-${item.startsAt}`}
            className="text-sm font-semibold text-muted"
          >
            {item.materialTitle}
            {item.status === "upcoming"
              ? ` · ${t("library.rental.starts")} ${item.startsAt.slice(0, 10)}`
              : ""}
            {` · `}
            <LibraryExpiryLabel expiresAt={item.expiresAt} />
          </li>
        ))}
      </ul>
    </section>
  );
}
