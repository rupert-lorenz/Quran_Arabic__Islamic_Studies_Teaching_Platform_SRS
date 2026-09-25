"use client";

import { useT } from "@/components/i18n/i18n-provider";
import { LibraryExpiryLabel } from "@/components/lms/library-expiry-label";
import type { LearnerPurchaseView } from "@/server/lms/purchases";

export function LibraryPurchasesCard({
  purchases,
}: {
  purchases: LearnerPurchaseView[];
}) {
  const t = useT();
  if (!purchases.length) return null;

  return (
    <section className="mb-6 rounded-2xl border border-line bg-surface p-4">
      <h3 className="font-heading text-lg font-bold tracking-tight text-brand">
        {t("library.purchase.yours")}
      </h3>
      <ul className="mt-3 grid gap-2">
        {purchases.map((item) => (
          <li
            key={`${item.materialId}-${item.purchasedAt}`}
            className="text-sm font-semibold text-muted"
          >
            {item.materialTitle}
            {` · ${t("library.purchase.owned")} ${item.purchasedAt.slice(0, 10)}`}
            {` · `}
            <LibraryExpiryLabel expiresAt={item.expiresAt} />
          </li>
        ))}
      </ul>
    </section>
  );
}
