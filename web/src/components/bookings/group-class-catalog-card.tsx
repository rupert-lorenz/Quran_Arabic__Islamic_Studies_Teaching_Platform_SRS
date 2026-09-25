"use client";

import Link from "next/link";
import { useT } from "@/components/i18n/i18n-provider";
import { ButtonLink } from "@/components/ui/button";
import { formatLessonDuration } from "@/lib/booking";
import type { GroupClassCatalogView } from "@/server/booking/group-lessons";

export function GroupClassCatalogCard({
  item,
}: {
  item: GroupClassCatalogView;
}) {
  const t = useT();
  return (
    <article className="flex h-full flex-col rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-soft">
        {item.subjectName}
      </p>
      <h2 className="mt-2 font-heading text-2xl font-bold tracking-tight text-brand">
        <Link href={item.href} className="hover:underline">
          {item.title}
        </Link>
      </h2>
      <p className="mt-1 font-semibold text-muted">{item.teacherName}</p>
      <dl className="mt-5 grid gap-2 text-sm">
        <div className="rounded-2xl bg-background px-4 py-3">
          <dt className="font-bold text-muted">{t("group.length")}</dt>
          <dd className="font-extrabold text-brand">
            {formatLessonDuration(item.durationMinutes)}
          </dd>
        </div>
        <div className="rounded-2xl bg-background px-4 py-3">
          <dt className="font-bold text-muted">{t("group.schedule")}</dt>
          <dd className="font-extrabold text-brand">
            {item.scheduleLabel || item.nextWhenLabel}
          </dd>
          <dd className="mt-1 text-xs font-semibold text-muted">
            {t("group.sessions_count", { count: item.sessionCount })}
            {item.scheduleLabel ? ` · ${t("group.next_session", { when: item.nextWhenLabel })}` : ""}
          </dd>
        </div>
        <div className="rounded-2xl bg-gold/60 px-4 py-3">
          <dt className="font-bold text-muted">{t("group.hourly_rate")}</dt>
          <dd className="font-extrabold text-brand">
            {t("group.price_per_session", { price: item.studentPriceFormatted })}
          </dd>
          {item.sessionCount > 1 ? (
            <dd className="mt-1 text-xs font-semibold text-muted">
              {t("group.series_total", {
                sessions: item.seriesSessionCount,
                total: item.seriesTotalFormatted,
              })}
            </dd>
          ) : null}
        </div>
      </dl>
      <div className="mt-auto pt-5">
        <ButtonLink href={item.href} className="w-full">
          {t("group.view_schedule")}
        </ButtonLink>
      </div>
    </article>
  );
}
