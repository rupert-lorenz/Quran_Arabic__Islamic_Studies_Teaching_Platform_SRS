"use client";

import { useT } from "@/components/i18n/i18n-provider";
import type { MarkingDesk as MarkingDeskView } from "@/server/lms/marking";

const kindKeys = {
  quiz: "marking.kind.quiz",
  exam: "marking.kind.exam",
  homework: "marking.kind.homework",
} as const;

export function MarkingDesk({ initial }: { initial: MarkingDeskView }) {
  const t = useT();
  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
        {t("marking.title")}
      </h2>
      <p className="mt-2 text-sm text-muted">{t("marking.help")}</p>
      {initial.items.length ? (
        <ul className="mt-6 grid gap-3">
          {initial.items.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <a
                href={item.href}
                className="block rounded-2xl bg-background px-4 py-3 text-sm font-semibold text-brand"
              >
                {item.title}
                {` · ${t(kindKeys[item.kind])}`}
                {` · ${item.studentName}`}
                {` · ${t("marking.pending")}`}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm font-semibold text-muted">{t("marking.none")}</p>
      )}
    </section>
  );
}
