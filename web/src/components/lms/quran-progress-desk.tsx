"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass, postJson } from "@/lib/api";
import type { UiMessageKey } from "@/lib/i18n";
import {
  QURAN_MODES,
  QURAN_SURAHS,
  quranPagePercent,
  quranSurahPercent,
  type QuranMode,
} from "@/lib/islamic-progress";
import type {
  QuranProgressDesk,
  QuranProgressProfile,
  QuranStreamView,
} from "@/server/lms/islamic-progress";

const modeKeys: Record<QuranMode, UiMessageKey> = {
  memorisation: "quran.mode.memorisation",
  revision: "quran.mode.revision",
  tajweed: "quran.mode.tajweed",
  reading: "quran.mode.reading",
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

function JuzGrid({ juz }: { juz: number | null }) {
  return (
    <ol className="mt-3 grid grid-cols-10 gap-1.5">
      {Array.from({ length: 30 }, (_, index) => index + 1).map((n) => (
        <li
          key={n}
          className={`rounded-md px-1 py-1.5 text-center text-xs font-semibold ${
            juz && n < juz
              ? "bg-brand text-white"
              : juz === n
                ? "bg-[#CB9F64] text-brand"
                : "bg-background text-muted"
          }`}
        >
          {n}
        </li>
      ))}
    </ol>
  );
}

function SurahSelect({
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
      <select name={name} className={fieldClass} defaultValue={value ?? ""}>
        <option value=""></option>
        {QURAN_SURAHS.map((surah) => (
          <option key={surah.n} value={surah.n}>
            {`${surah.n} · ${surah.en} · ${surah.ar}`}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  name,
  value,
  label,
  min,
  max,
}: {
  name: string;
  value: number | null;
  label: string;
  min: number;
  max: number;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-muted">
      {label}
      <input
        name={name}
        type="number"
        min={min}
        max={max}
        defaultValue={value ?? ""}
        className={fieldClass}
      />
    </label>
  );
}

function StreamFields({
  stream,
  prefix,
}: {
  stream: QuranStreamView;
  prefix: QuranMode;
}) {
  const t = useT();
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <SurahSelect
        name={`${prefix}Surah`}
        value={stream.surah}
        label={t("quran.surah")}
      />
      <NumberField
        name={`${prefix}Juz`}
        value={stream.juz}
        label={t("quran.juz")}
        min={1}
        max={30}
      />
      <NumberField
        name={`${prefix}Page`}
        value={stream.page}
        label={t("quran.page")}
        min={1}
        max={604}
      />
      <NumberField
        name={`${prefix}Ayah`}
        value={stream.ayah}
        label={t("quran.ayah")}
        min={1}
        max={286}
      />
      <NumberField
        name={`${prefix}Percent`}
        value={stream.percent}
        label={t("quran.stream_percent")}
        min={0}
        max={100}
      />
    </div>
  );
}

function QuranForm({
  profile,
  pending,
  onSave,
}: {
  profile: QuranProgressProfile;
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
          {t("quran.current")}
        </h3>
        <SurahSelect name="surah" value={profile.surah} label={t("quran.surah")} />
        <NumberField
          name="juz"
          value={profile.juz}
          label={t("quran.juz")}
          min={1}
          max={30}
        />
        <NumberField
          name="page"
          value={profile.page}
          label={t("quran.page")}
          min={1}
          max={604}
        />
        <NumberField
          name="ayah"
          value={profile.ayah}
          label={t("quran.ayah")}
          min={1}
          max={286}
        />
        <label className="grid gap-1 text-sm font-semibold text-muted md:col-span-2">
          {t("quran.focus")}
          <select
            name="quranMode"
            className={fieldClass}
            defaultValue={profile.quranMode ?? ""}
          >
            <option value=""></option>
            {QURAN_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {t(modeKeys[mode])}
              </option>
            ))}
          </select>
        </label>
      </section>
      {profile.streams.map((stream) => (
        <section key={stream.mode} className="grid gap-3">
          <h3 className="font-heading text-xl font-bold tracking-tight text-brand">
            {t(modeKeys[stream.mode])}
          </h3>
          <StreamFields stream={stream} prefix={stream.mode} />
        </section>
      ))}
      <label className="grid gap-1 text-sm font-semibold text-muted">
        {t("quran.weekly")}
        <input
          name="weeklyTarget"
          defaultValue={profile.weeklyTarget}
          className={fieldClass}
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-muted">
        {t("quran.next")}
        <input
          name="nextLessonTarget"
          defaultValue={profile.nextLessonTarget}
          className={fieldClass}
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-muted">
        {t("quran.comment")}
        <textarea
          name="comment"
          rows={3}
          className={`${fieldClass} min-h-24 py-3`}
        />
      </label>
      <Button type="submit" disabled={pending}>
        {t("quran.save")}
      </Button>
    </form>
  );
}

export function QuranProgressDeskView({ desk }: { desk: QuranProgressDesk }) {
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
      const next = await postJson<QuranProgressDesk>(
        "/api/v1/progress/quran",
        body,
      );
      setCurrent(next);
      setMessage(t("quran.saved"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("quran.failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      {current.learners.length > 1 ? (
        <p className="text-sm font-semibold">
          {t("quran.choose")}
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
              {t("quran.for", { name: profile.studentName })}
            </p>
            <h2 className="font-heading mt-2 text-3xl font-bold tracking-tight text-brand">
              {t("quran.current")}
            </h2>
            <p className="mt-3 text-lg text-brand">
              {[
                profile.surahLabel || null,
                profile.juz ? t("quran.juz_line", { n: profile.juz }) : null,
                profile.page ? t("quran.page_line", { n: profile.page }) : null,
                profile.ayah ? t("quran.ayah_line", { n: profile.ayah }) : null,
                profile.quranMode ? t(modeKeys[profile.quranMode]) : null,
              ]
                .filter(Boolean)
                .join(" · ") || t("quran.none.position")}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <article className="rounded-2xl bg-background px-4 py-4">
                <Bar
                  label={t("quran.visual.juz")}
                  value={profile.completionPercent}
                />
              </article>
              <article className="rounded-2xl bg-background px-4 py-4">
                <Bar
                  label={t("quran.visual.page")}
                  value={quranPagePercent(profile.page)}
                />
              </article>
              <article className="rounded-2xl bg-[#F3E6D0] px-4 py-4">
                <Bar
                  label={t("quran.visual.surah")}
                  value={quranSurahPercent(profile.surah)}
                />
              </article>
            </div>
            <p className="mt-5 text-sm font-semibold text-muted">
              {t("quran.visual.juz_map")}
            </p>
            <JuzGrid juz={profile.juz} />
            <dl className="mt-5 grid gap-2 text-sm">
              {profile.weeklyTarget ? (
                <div>
                  <dt className="font-semibold text-muted">{t("quran.weekly")}</dt>
                  <dd className="text-brand">{profile.weeklyTarget}</dd>
                </div>
              ) : null}
              {profile.nextLessonTarget ? (
                <div>
                  <dt className="font-semibold text-muted">{t("quran.next")}</dt>
                  <dd className="text-brand">{profile.nextLessonTarget}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            {profile.streams.map((stream) => (
              <article
                key={stream.mode}
                className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
              >
                <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
                  {t(modeKeys[stream.mode])}
                </p>
                <p className="font-heading mt-2 text-2xl font-bold tracking-tight text-brand">
                  {percentLabel(stream.percent)}
                </p>
                <p className="mt-2 text-sm text-muted">
                  {[
                    stream.surahLabel || null,
                    stream.juz ? t("quran.juz_line", { n: stream.juz }) : null,
                    stream.page ? t("quran.page_line", { n: stream.page }) : null,
                    stream.ayah ? t("quran.ayah_line", { n: stream.ayah }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || t("quran.none.stream")}
                </p>
                <div className="mt-3">
                  <Bar label={t("quran.stream_percent")} value={stream.percent} />
                </div>
              </article>
            ))}
          </section>

          <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
              {t("quran.comments")}
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
              <p className="mt-3 text-sm text-muted">{t("quran.none.comments")}</p>
            )}
            {current.canEdit ? (
              <QuranForm profile={profile} pending={pending} onSave={onSave} />
            ) : null}
          </section>
        </>
      ) : (
        <p className="rounded-[2rem] border border-line bg-surface px-5 py-4 text-sm text-muted">
          {current.learners.length ? t("quran.pick") : t("quran.none.learners")}
        </p>
      )}
    </div>
  );
}
