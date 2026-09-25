"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass, postJson } from "@/lib/api";
import { EDUCATIONAL_GAME_KINDS } from "@/lib/games";
import type { EducationalGameDesk } from "@/server/lms/games";

const statusKeys = {
  draft: "games.status.draft",
  published: "games.status.published",
  archived: "games.status.archived",
} as const;

const kindKeys = {
  match: "games.kind.match",
  memory: "games.kind.memory",
  order: "games.kind.order",
  choice: "games.kind.choice",
} as const;

export function GamesDesk({ initial }: { initial: EducationalGameDesk }) {
  const t = useT();
  const [desk, setDesk] = useState(initial);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    setPending(true);
    setError("");
    setMessage("");
    try {
      const next = await postJson<EducationalGameDesk>("/api/v1/games", body);
      setDesk(next);
      setMessage(t("games.saved"));
      form.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("games.failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
        {t("games.title")}
      </h2>
      <p className="mt-2 text-sm text-muted">{t("games.help")}</p>

      <form className="mt-6 grid gap-3 md:grid-cols-2" onSubmit={onCreate}>
        <input
          name="title"
          required
          placeholder={t("games.name")}
          className={`${fieldClass} md:col-span-2`}
        />
        <textarea
          name="instructions"
          rows={3}
          placeholder={t("games.instructions")}
          className={`${fieldClass} min-h-24 py-3 md:col-span-2`}
        />
        <select name="kind" className={fieldClass} defaultValue="match">
          {EDUCATIONAL_GAME_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(kindKeys[kind])}
            </option>
          ))}
        </select>
        <select name="subjectSlug" className={fieldClass} defaultValue="">
          <option value="">{t("library.any_subject")}</option>
          {desk.subjects.map((subject) => (
            <option key={subject.slug} value={subject.slug}>
              {subject.name}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={pending} className="md:col-span-2">
          {t("games.create")}
        </Button>
      </form>

      {desk.items.length ? (
        <ul className="mt-6 grid gap-3">
          {desk.items.map((item) => (
            <li key={item.id}>
              <a
                href={item.href}
                className="block rounded-2xl bg-background px-4 py-3 text-sm font-semibold text-brand"
              >
                {item.title}
                {` · ${t(kindKeys[item.kind])}`}
                {` · ${t(statusKeys[item.status])}`}
                {item.playCount
                  ? ` · ${t("games.play_count", { count: item.playCount })}`
                  : ""}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm font-semibold text-muted">{t("games.none")}</p>
      )}

      {error ? <p className="mt-4 text-sm font-semibold text-brand">{error}</p> : null}
      {message ? <p className="mt-4 text-sm font-semibold text-brand">{message}</p> : null}
    </section>
  );
}
