"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass, postJson } from "@/lib/api";
import type { UiMessageKey } from "@/lib/i18n";
import {
  PROGRESS_ASSESSMENT_STATUSES,
  PROGRESS_HOMEWORK_STATUSES,
  QURAN_MODES,
  QURAN_SURAHS,
  arabicCompletion,
  quranCompletion,
  type IslamicProgressTrack,
} from "@/lib/islamic-progress";
import type {
  IslamicProgressDesk,
  IslamicProgressTrackView,
} from "@/server/lms/islamic-progress";

const trackTitleKeys: Record<IslamicProgressTrack, UiMessageKey> = {
  quran: "progress.track.quran",
  arabic: "progress.track.arabic",
  islamic_studies: "progress.track.islamic",
};

const modeKeys: Record<(typeof QURAN_MODES)[number], UiMessageKey> = {
  memorisation: "progress.mode.memorisation",
  revision: "progress.mode.revision",
  tajweed: "progress.mode.tajweed",
  reading: "progress.mode.reading",
};

const homeworkKeys: Record<
  (typeof PROGRESS_HOMEWORK_STATUSES)[number],
  UiMessageKey
> = {
  none: "progress.homework.none",
  assigned: "progress.homework.assigned",
  submitted: "progress.homework.submitted",
  marked: "progress.homework.marked",
};

const assessmentKeys: Record<
  (typeof PROGRESS_ASSESSMENT_STATUSES)[number],
  UiMessageKey
> = {
  none: "progress.assessment.none",
  in_progress: "progress.assessment.in_progress",
  passed: "progress.assessment.passed",
  needs_review: "progress.assessment.needs_review",
};

const skillKeys = {
  reading: "progress.skill.reading",
  writing: "progress.skill.writing",
  speaking: "progress.skill.speaking",
  listening: "progress.skill.listening",
  vocabulary: "progress.skill.vocabulary",
  grammar: "progress.skill.grammar",
} as const satisfies Record<string, UiMessageKey>;

function percentLabel(value: number | null) {
  return value == null ? "—" : `${value}%`;
}

function SkillBar({ label, value }: { label: string; value: number | null }) {
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

function TrackForm({
  track,
  studentUserId,
  pending,
  onSave,
}: {
  track: IslamicProgressTrackView;
  studentUserId: string;
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
    <form className="mt-5 grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
      <input type="hidden" name="studentUserId" value={studentUserId} />
      <input type="hidden" name="track" value={track.track} />
      {track.track === "quran" ? (
        <>
          <select name="surah" className={fieldClass} defaultValue={track.surah ?? ""}>
            <option value="">{t("progress.surah")}</option>
            {QURAN_SURAHS.map((surah) => (
              <option key={surah.n} value={surah.n}>
                {`${surah.n} · ${surah.en} · ${surah.ar}`}
              </option>
            ))}
          </select>
          <input
            name="juz"
            type="number"
            min={1}
            max={30}
            defaultValue={track.juz ?? ""}
            placeholder={t("progress.juz")}
            className={fieldClass}
          />
          <input
            name="page"
            type="number"
            min={1}
            max={604}
            defaultValue={track.page ?? ""}
            placeholder={t("progress.page")}
            className={fieldClass}
          />
          <input
            name="ayah"
            type="number"
            min={1}
            max={286}
            defaultValue={track.ayah ?? ""}
            placeholder={t("progress.ayah")}
            className={fieldClass}
          />
          <select
            name="quranMode"
            className={fieldClass}
            defaultValue={track.quranMode ?? ""}
          >
            <option value="">{t("progress.mode")}</option>
            {QURAN_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {t(modeKeys[mode])}
              </option>
            ))}
          </select>
        </>
      ) : null}
      {track.track === "arabic" ? (
        <>
          <input
            name="bookTitle"
            defaultValue={track.bookTitle}
            placeholder={t("progress.book")}
            className={fieldClass}
          />
          <input
            name="pagesNote"
            defaultValue={track.pagesNote}
            placeholder={t("progress.pages")}
            className={fieldClass}
          />
          {(
            [
              ["reading", track.reading],
              ["writing", track.writing],
              ["speaking", track.speaking],
              ["listening", track.listening],
              ["vocabulary", track.vocabulary],
              ["grammar", track.grammar],
            ] as const
          ).map(([name, value]) => (
            <input
              key={name}
              name={name}
              type="number"
              min={0}
              max={100}
              defaultValue={value ?? ""}
              placeholder={t(skillKeys[name])}
              className={fieldClass}
            />
          ))}
        </>
      ) : null}
      {track.track === "islamic_studies" ? (
        <>
          <input
            name="courseTitle"
            defaultValue={track.courseTitle}
            placeholder={t("progress.course")}
            className={`${fieldClass} md:col-span-2`}
          />
          <select
            name="homeworkStatus"
            className={fieldClass}
            defaultValue={track.homeworkStatus ?? ""}
          >
            <option value="">{t("progress.homework")}</option>
            {PROGRESS_HOMEWORK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(homeworkKeys[status])}
              </option>
            ))}
          </select>
          <select
            name="assessmentStatus"
            className={fieldClass}
            defaultValue={track.assessmentStatus ?? ""}
          >
            <option value="">{t("progress.assessment")}</option>
            {PROGRESS_ASSESSMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(assessmentKeys[status])}
              </option>
            ))}
          </select>
          <input
            name="completionPercent"
            type="number"
            min={0}
            max={100}
            defaultValue={track.completionPercent ?? ""}
            placeholder={t("progress.completion")}
            className={fieldClass}
          />
        </>
      ) : null}
      <input
        name="levelLabel"
        defaultValue={track.levelLabel}
        placeholder={t("progress.level")}
        className={fieldClass}
      />
      <input
        name="unitLabel"
        defaultValue={track.unitLabel}
        placeholder={t("progress.unit")}
        className={fieldClass}
      />
      <input
        name="lessonLabel"
        defaultValue={track.lessonLabel}
        placeholder={t("progress.lesson")}
        className={`${fieldClass} md:col-span-2`}
      />
      <input
        name="weeklyTarget"
        defaultValue={track.weeklyTarget}
        placeholder={t("progress.weekly")}
        className={`${fieldClass} md:col-span-2`}
      />
      <input
        name="nextLessonTarget"
        defaultValue={track.nextLessonTarget}
        placeholder={t("progress.next")}
        className={`${fieldClass} md:col-span-2`}
      />
      <textarea
        name="comment"
        rows={3}
        placeholder={t("progress.comment")}
        className={`${fieldClass} min-h-24 py-3 md:col-span-2`}
      />
      <Button type="submit" disabled={pending} className="md:col-span-2">
        {t("progress.save")}
      </Button>
    </form>
  );
}

function quranHrefFromDesk(href: string, studentUserId: string) {
  if (href.includes("/family/children/")) {
    return `/family/children/${studentUserId}/quran`;
  }
  if (href.startsWith("/family")) return `/family/quran?student=${studentUserId}`;
  if (href.startsWith("/teach")) return `/teach/quran?student=${studentUserId}`;
  if (href.startsWith("/staff")) {
    return `/staff/academic/quran?student=${studentUserId}`;
  }
  return "/learn/quran";
}

function arabicHrefFromDesk(href: string, studentUserId: string) {
  if (href.includes("/family/children/")) {
    return `/family/children/${studentUserId}/arabic`;
  }
  if (href.startsWith("/family")) return `/family/arabic?student=${studentUserId}`;
  if (href.startsWith("/teach")) return `/teach/arabic?student=${studentUserId}`;
  if (href.startsWith("/staff")) {
    return `/staff/academic/arabic?student=${studentUserId}`;
  }
  return "/learn/arabic";
}

function islamicHrefFromDesk(href: string, studentUserId: string) {
  if (href.includes("/family/children/")) {
    return `/family/children/${studentUserId}/islamic-studies`;
  }
  if (href.startsWith("/family")) {
    return `/family/islamic-studies?student=${studentUserId}`;
  }
  if (href.startsWith("/teach")) {
    return `/teach/islamic-studies?student=${studentUserId}`;
  }
  if (href.startsWith("/staff")) {
    return `/staff/academic/islamic-studies?student=${studentUserId}`;
  }
  return "/learn/islamic-studies";
}

function TrackCard({
  track,
  studentUserId,
  quranHref,
  arabicHref,
  islamicHref,
  canEdit,
  pending,
  onSave,
}: {
  track: IslamicProgressTrackView;
  studentUserId: string;
  quranHref: string;
  arabicHref: string;
  islamicHref: string;
  canEdit: boolean;
  pending: boolean;
  onSave: (body: Record<string, string>) => Promise<void>;
}) {
  const t = useT();
  const percent =
    track.track === "quran"
      ? quranCompletion(track.juz, track.completionPercent)
      : track.track === "arabic"
        ? track.completionPercent ??
          arabicCompletion([
            track.reading,
            track.writing,
            track.speaking,
            track.listening,
            track.vocabulary,
            track.grammar,
          ])
        : track.completionPercent;

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
        {t(trackTitleKeys[track.track])}
      </p>
      <h3 className="font-heading mt-2 text-2xl font-bold tracking-tight text-brand">
        {percentLabel(percent)}
      </h3>
      {track.track === "quran" ? (
        <>
          <p className="mt-3 text-sm font-semibold">
            <a href={quranHref} className="text-brand underline">
              {t("progress.open_quran")}
            </a>
          </p>
          <p className="mt-3 text-sm text-muted">
            {[
              track.surahLabel || null,
              track.juz ? t("progress.juz_line", { n: track.juz }) : null,
              track.page ? t("progress.page_line", { n: track.page }) : null,
              track.ayah ? t("progress.ayah_line", { n: track.ayah }) : null,
              track.quranMode ? t(modeKeys[track.quranMode]) : null,
            ]
              .filter(Boolean)
              .join(" · ") || t("progress.none.position")}
          </p>
          <JuzGrid juz={track.juz} />
        </>
      ) : null}
      {track.track === "islamic_studies" ? (
        <p className="mt-3 text-sm font-semibold">
          <a href={islamicHref} className="text-brand underline">
            {t("progress.open_islamic")}
          </a>
        </p>
      ) : null}
      {track.track === "arabic" ? (
        <>
          <p className="mt-3 text-sm font-semibold">
            <a href={arabicHref} className="text-brand underline">
              {t("progress.open_arabic")}
            </a>
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SkillBar label={t("progress.skill.reading")} value={track.reading} />
            <SkillBar label={t("progress.skill.writing")} value={track.writing} />
            <SkillBar label={t("progress.skill.speaking")} value={track.speaking} />
            <SkillBar label={t("progress.skill.listening")} value={track.listening} />
            <SkillBar label={t("progress.skill.vocabulary")} value={track.vocabulary} />
            <SkillBar label={t("progress.skill.grammar")} value={track.grammar} />
          </div>
        </>
      ) : null}
      <dl className="mt-4 grid gap-2 text-sm">
        {track.bookTitle ? (
          <div>
            <dt className="font-semibold text-muted">{t("progress.book")}</dt>
            <dd className="text-brand">{track.bookTitle}</dd>
          </div>
        ) : null}
        {track.pagesNote ? (
          <div>
            <dt className="font-semibold text-muted">{t("progress.pages")}</dt>
            <dd className="text-brand">{track.pagesNote}</dd>
          </div>
        ) : null}
        {track.courseTitle ? (
          <div>
            <dt className="font-semibold text-muted">{t("progress.course")}</dt>
            <dd className="text-brand">{track.courseTitle}</dd>
          </div>
        ) : null}
        {track.levelLabel ? (
          <div>
            <dt className="font-semibold text-muted">{t("progress.level")}</dt>
            <dd className="text-brand">{track.levelLabel}</dd>
          </div>
        ) : null}
        {track.unitLabel ? (
          <div>
            <dt className="font-semibold text-muted">{t("progress.unit")}</dt>
            <dd className="text-brand">{track.unitLabel}</dd>
          </div>
        ) : null}
        {track.lessonLabel ? (
          <div>
            <dt className="font-semibold text-muted">{t("progress.lesson")}</dt>
            <dd className="text-brand">{track.lessonLabel}</dd>
          </div>
        ) : null}
        {track.homeworkStatus ? (
          <div>
            <dt className="font-semibold text-muted">{t("progress.homework")}</dt>
            <dd className="text-brand">{t(homeworkKeys[track.homeworkStatus])}</dd>
          </div>
        ) : null}
        {track.assessmentStatus ? (
          <div>
            <dt className="font-semibold text-muted">{t("progress.assessment")}</dt>
            <dd className="text-brand">
              {t(assessmentKeys[track.assessmentStatus])}
            </dd>
          </div>
        ) : null}
        {track.weeklyTarget ? (
          <div>
            <dt className="font-semibold text-muted">{t("progress.weekly")}</dt>
            <dd className="text-brand">{track.weeklyTarget}</dd>
          </div>
        ) : null}
        {track.nextLessonTarget ? (
          <div>
            <dt className="font-semibold text-muted">{t("progress.next")}</dt>
            <dd className="text-brand">{track.nextLessonTarget}</dd>
          </div>
        ) : null}
      </dl>
      {track.notes.length ? (
        <ol className="mt-4 grid gap-2">
          {track.notes.map((note) => (
            <li key={note.id} className="rounded-2xl bg-background px-4 py-3">
              <p className="text-sm text-brand">{note.body}</p>
              <p className="mt-1 text-xs text-muted">
                {note.authorName} · {new Date(note.at).toLocaleString()}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-muted">{t("progress.none.comments")}</p>
      )}
      {canEdit ? (
        <TrackForm
          track={track}
          studentUserId={studentUserId}
          pending={pending}
          onSave={onSave}
        />
      ) : null}
    </section>
  );
}

export function IslamicProgressDeskView({
  desk,
}: {
  desk: IslamicProgressDesk;
}) {
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
      const next = await postJson<IslamicProgressDesk>("/api/v1/progress", body);
      setCurrent(next);
      setMessage(t("progress.saved"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("progress.failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      {current.learners.length > 1 ? (
        <p className="text-sm font-semibold">
          {t("progress.choose")}
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
          <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
            {t("progress.for", { name: profile.studentName })}
          </p>
          <div className="grid gap-6">
            {profile.tracks.map((track) => (
              <TrackCard
                key={track.track}
                track={track}
                studentUserId={profile.studentUserId}
                quranHref={quranHrefFromDesk(
                  current.href,
                  profile.studentUserId,
                )}
                arabicHref={arabicHrefFromDesk(
                  current.href,
                  profile.studentUserId,
                )}
                islamicHref={islamicHrefFromDesk(
                  current.href,
                  profile.studentUserId,
                )}
                canEdit={current.canEdit}
                pending={pending}
                onSave={onSave}
              />
            ))}
          </div>
        </>
      ) : (
        <p className="rounded-[2rem] border border-line bg-surface px-5 py-4 text-sm text-muted">
          {current.learners.length ? t("progress.pick") : t("progress.none.learners")}
        </p>
      )}
    </div>
  );
}
