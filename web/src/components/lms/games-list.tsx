"use client";

import { useT } from "@/components/i18n/i18n-provider";
import type { EducationalGameView } from "@/server/lms/games";

const kindKeys = {
  match: "games.kind.match",
  memory: "games.kind.memory",
  order: "games.kind.order",
  choice: "games.kind.choice",
} as const;

export function GamesList({ items }: { items: EducationalGameView[] }) {
  const t = useT();
  if (!items.length) {
    return <p className="text-sm font-semibold text-muted">{t("games.none")}</p>;
  }

  return (
    <ul className="grid gap-3">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={item.href}
            className="block rounded-[2rem] border border-line bg-surface px-5 py-4 shadow-[var(--shadow-card)]"
          >
            <p className="font-heading text-lg font-bold tracking-tight text-brand">
              {item.title}
            </p>
            <p className="mt-1 text-sm font-semibold text-muted">
              {t(kindKeys[item.kind])}
              {item.subjectName ? ` · ${item.subjectName}` : ""}
              {item.lastPlay
                ? ` · ${t("games.score", {
                    score: item.lastPlay.score,
                    total: item.lastPlay.total,
                  })}`
                : ` · ${t("games.play")}`}
            </p>
          </a>
        </li>
      ))}
    </ul>
  );
}
