"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass, postJson } from "@/lib/api";
import type { UiMessageKey } from "@/lib/i18n";
import { ARABIC_SKILLS, type ArabicSkill } from "@/lib/islamic-progress";
import type {
  ArabicProgressDesk,
  ArabicProgressProfile,
} from "@/server/lms/islamic-progress";

const skillKeys: Record<ArabicSkill, UiMessageKey> = {
  reading: "arabic.skill.reading",
  writing: "arabic.skill.writing",
  speaking: "arabic.skill.speaking",
  listening: "arabic.skill.listening",
  vocabulary: "arabic.skill.vocabulary",
  grammar: "arabic.skill.grammar",
};

function percentLabel(value: number | null) {
  return value == null ? "—" : `${value}%`;
}

function Bar({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="flex justify-between text-sm font-semibold text-brand">
        <span>{label}</span>
        <span>{percentLabel(value)}</span>
      </p>
      <div className="mt-1 h-2 rounded-full bg-background">
        <div
          className="h-2 rounded-full bg-brand"
          style={{ width: `${value ?? 0}%` }}
        />
      </div>
    </div>
  );
}

function TextField({
  name,
  value,
  label,
  span,
}: {
  name: string;
  value: string;
  label: string;
  span?: boolean;
}) {
  return (
    <label
      className={`grid gap-1 text-sm font-semibold text-muted${span ? " md:col-span-2" : ""}`}
    >
      {label}
      <input name={name} defaultValue={value} className={fieldClass} />
    </label>
  );
}

function SkillField({
  name,
  value,
  label,
}: {
  name: string;
  value: number | null;
  label: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-muted">
      {label}
      <input
        name={name}
        type="number"
        min={0}
        max={100}
        defaultValue={value ?? ""}
        className={fieldClass}
      />
    </label>
  );
}

function ArabicForm({
  profile,
  pending,
  onSave,
}: {
  profile: ArabicProgressProfile;
  pending: boolean;
  onSave: (body: Record<string, string>) => Promise<void>;
}) {
  const t = useT();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    await onSave(
      Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, String(value)]),
      ),
    );
  }

  return (
    <form className="mt-6 grid gap-6" onSubmit={onSubmit}>
      <input type="hidden" name="studentUserId" value={profile.studentUserId} />
      <section className="grid gap-3 md:grid-cols-2">
        <h3 className="font-heading text-xl font-bold tracking-tight text-brand md:col-span-2">
          {t("arabic.book_place")}
        </h3>
        <TextField
          name="bookTitle"
          value={profile.bookTitle}
          label={t("arabic.book")}
          span
        />
        <TextField
          name="levelLabel"
          value={profile.levelLabel}
          label={t("arabic.level")}
        />
        <TextField
          name="unitLabel"
          value={profile.unitLabel}
          label={t("arabic.unit")}
        />
        <TextField
          name="lessonLabel"
          value={profile.lessonLabel}
          label={t("arabic.lesson")}
        />
        <TextField
          name="pagesNote"
          value={profile.pagesNote}
          label={t("arabic.pages")}
        />
      </section>
      <section className="grid gap-3 md:grid-cols-2">
        <h3 className="font-heading text-xl font-bold tracking-tight text-brand md:col-span-2">
          {t("arabic.skills")}
        </h3>
        {ARABIC_SKILLS.map((skill) => (
          <SkillField
            key={skill}
            name={skill}
            value={profile[skill]}
            label={t(skillKeys[skill])}
          />
        ))}
      </section>
      <TextField
        name="weeklyTarget"
        value={profile.weeklyTarget}
        label={t("arabic.weekly")}
        span
      />
      <TextField
        name="nextLessonTarget"
        value={profile.nextLessonTarget}
        label={t("arabic.next")}
        span
      />
      <label className="grid gap-1 text-sm font-semibold text-muted">
        {t("arabic.comment")}
        <textarea
          name="comment"
          rows={3}
          className={`${fieldClass} min-h-24 py-3`}
        />
      </label>
      <Button type="submit" disabled={pending}>
        {t("arabic.save")}
      </Button>
    </form>
  );
}

export function ArabicProgressDeskView({ desk }: { desk: ArabicProgressDesk }) {
  const t = useT();
  const [current, setCurrent] = useState(desk);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const profile = current.profile;

  async function onSave(body: Record<string, string>) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const next = await postJson<ArabicProgressDesk>(
        "/api/v1/progress/arabic",
        body,
      );
      setCurrent(next);
      setMessage(t("arabic.saved"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("arabic.failed"));
    } finally {
      setPending(false);
    }
  }

  const place =
    profile &&
    [
      profile.bookTitle || null,
      profile.levelLabel || null,
      profile.unitLabel || null,
      profile.lessonLabel || null,
      profile.pagesNote || null,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <div className="space-y-8">
      {current.learners.length > 1 ? (
        <p className="text-sm font-semibold">
          {t("arabic.choose")}
          {": "}
          {current.learners.map((learner, index) => (
            <span key={learner.studentUserId}>
              {index ? " · " : null}
              <a href={learner.href} className="text-brand underline">
                {learner.name}
              </a>
            </span>
          ))}
        </p>
      ) : null}

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-brand">{message}</p> : null}

      {profile ? (
        <>
          <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
              {t("arabic.for", { name: profile.studentName })}
            </p>
            <h2 className="font-heading mt-2 text-3xl font-bold tracking-tight text-brand">
              {t("arabic.book_place")}
            </h2>
            <p className="mt-3 text-lg text-brand">
              {place || t("arabic.none.place")}
            </p>
            <div className="mt-5 rounded-2xl bg-[#F3E6D0] px-4 py-4">
              <Bar label={t("arabic.overall")} value={profile.completionPercent} />
            </div>
            <dl className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
              {profile.bookTitle ? (
                <div>
                  <dt className="font-semibold text-muted">{t("arabic.book")}</dt>
                  <dd className="text-brand">{profile.bookTitle}</dd>
                </div>
              ) : null}
              {profile.levelLabel ? (
                <div>
                  <dt className="font-semibold text-muted">{t("arabic.level")}</dt>
                  <dd className="text-brand">{profile.levelLabel}</dd>
                </div>
              ) : null}
              {profile.unitLabel ? (
                <div>
                  <dt className="font-semibold text-muted">{t("arabic.unit")}</dt>
                  <dd className="text-brand">{profile.unitLabel}</dd>
                </div>
              ) : null}
              {profile.lessonLabel ? (
                <div>
                  <dt className="font-semibold text-muted">{t("arabic.lesson")}</dt>
                  <dd className="text-brand">{profile.lessonLabel}</dd>
                </div>
              ) : null}
              {profile.pagesNote ? (
                <div>
                  <dt className="font-semibold text-muted">{t("arabic.pages")}</dt>
                  <dd className="text-brand">{profile.pagesNote}</dd>
                </div>
              ) : null}
              {profile.weeklyTarget ? (
                <div>
                  <dt className="font-semibold text-muted">{t("arabic.weekly")}</dt>
                  <dd className="text-brand">{profile.weeklyTarget}</dd>
                </div>
              ) : null}
              {profile.nextLessonTarget ? (
                <div>
                  <dt className="font-semibold text-muted">{t("arabic.next")}</dt>
                  <dd className="text-brand">{profile.nextLessonTarget}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {profile.skills.map((item) => (
              <article
                key={item.skill}
                className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
              >
                <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
                  {t(skillKeys[item.skill])}
                </p>
                <p className="font-heading mt-2 text-2xl font-bold tracking-tight text-brand">
                  {percentLabel(item.percent)}
                </p>
                <div className="mt-3">
                  <Bar label={t("arabic.skill_percent")} value={item.percent} />
                </div>
              </article>
            ))}
          </section>

          <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
              {t("arabic.comments")}
            </h2>
            {profile.notes.length ? (
              <ol className="mt-4 grid gap-2">
                {profile.notes.map((note) => (
                  <li key={note.id} className="rounded-2xl bg-background px-4 py-3">
                    <p className="text-sm text-brand">{note.body}</p>
                    <p className="mt-1 text-xs text-muted">
                      {note.authorName} · {new Date(note.at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-muted">{t("arabic.none.comments")}</p>
            )}
            {current.canEdit ? (
              <ArabicForm profile={profile} pending={pending} onSave={onSave} />
            ) : null}
          </section>
        </>
      ) : (
        <p className="rounded-[2rem] border border-line bg-surface px-5 py-4 text-sm text-muted">
          {current.learners.length ? t("arabic.pick") : t("arabic.none.learners")}
        </p>
      )}
    </div>
  );
}
