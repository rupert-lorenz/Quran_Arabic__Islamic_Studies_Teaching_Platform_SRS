"use client";

import { useT } from "@/components/i18n/i18n-provider";
import { LibraryExpiryLabel } from "@/components/lms/library-expiry-label";
import type { LearnerSubscriptionView } from "@/server/lms/subscriptions";

export function LibrarySubscriptionsCard({
  subscriptions,
}: {
  subscriptions: LearnerSubscriptionView[];
}) {
  const t = useT();
  if (!subscriptions.length) return null;

  return (
    <section className="mb-6 rounded-2xl border border-line bg-surface p-4">
      <h3 className="font-heading text-lg font-bold tracking-tight text-brand">
        {t("library.subscription.yours")}
      </h3>
      <ul className="mt-3 grid gap-2">
        {subscriptions.map((item) => (
          <li
            key={`${item.planKey}-${item.startsAt}`}
            className="text-sm font-semibold text-muted"
          >
            {item.planName}
            {item.monthly ? ` · ${t("library.subscription.monthly")}` : ""}
            {item.amountFormatted
              ? ` · ${t("library.subscription.price", { price: item.amountFormatted })}`
              : ""}
            {item.listedPriceFormatted
              ? ` · ${t("card.listed_as", { price: item.listedPriceFormatted })}`
              : ""}
            {` · `}
            <LibraryExpiryLabel expiresAt={item.expiresAt} />
          </li>
        ))}
      </ul>
    </section>
  );
}
