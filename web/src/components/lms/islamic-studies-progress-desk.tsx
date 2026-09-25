"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass, postJson } from "@/lib/api";
import type { UiMessageKey } from "@/lib/i18n";
import {
  PROGRESS_ASSESSMENT_STATUSES,
  PROGRESS_HOMEWORK_STATUSES,
  type ProgressAssessmentStatus,
  type ProgressHomeworkStatus,
} from "@/lib/islamic-progress";
import type {
  IslamicStudiesProgressDesk,
  IslamicStudiesProgressProfile,
} from "@/server/lms/islamic-progress";

const homeworkKeys: Record<ProgressHomeworkStatus, UiMessageKey> = {
  none: "islamic.homework.none",
  assigned: "islamic.homework.assigned",
  submitted: "islamic.homework.submitted",
  marked: "islamic.homework.marked",
};

const assessmentKeys: Record<ProgressAssessmentStatus, UiMessageKey> = {
  none: "islamic.assessment.none",
  in_progress: "islamic.assessment.in_progress",
  passed: "islamic.assessment.passed",
  needs_review: "islamic.assessment.needs_review",
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

function IslamicStudiesForm({
  profile,
  pending,
  onSave,
}: {
  profile: IslamicStudiesProgressProfile;
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
          {t("islamic.course_place")}
        </h3>
        <TextField
          name="courseTitle"
          value={profile.courseTitle}
          label={t("islamic.course")}
          span
        />
        <TextField
          name="levelLabel"
          value={profile.levelLabel}
          label={t("islamic.level")}
        />
        <TextField
          name="unitLabel"
          value={profile.unitLabel}
          label={t("islamic.unit")}
        />
        <TextField
          name="lessonLabel"
          value={profile.lessonLabel}
          label={t("islamic.lesson")}
          span
        />
      </section>
      <section className="grid gap-3 md:grid-cols-2">
        <h3 className="font-heading text-xl font-bold tracking-tight text-brand md:col-span-2">
          {t("islamic.status")}
        </h3>
        <label className="grid gap-1 text-sm font-semibold text-muted">
          {t("islamic.homework")}
          <select
            name="homeworkStatus"
            className={fieldClass}
            defaultValue={profile.homeworkStatus ?? ""}
          >
            <option value=""></option>
            {PROGRESS_HOMEWORK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(homeworkKeys[status])}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-muted">
          {t("islamic.assessment")}
          <select
            name="assessmentStatus"
            className={fieldClass}
            defaultValue={profile.assessmentStatus ?? ""}
          >
            <option value=""></option>
            {PROGRESS_ASSESSMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(assessmentKeys[status])}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-muted md:col-span-2">
          {t("islamic.completion")}
          <input
            name="completionPercent"
            type="number"
            min={0}
            max={100}
            defaultValue={profile.completionPercent ?? ""}
            className={fieldClass}
          />
        </label>
      </section>
      <TextField
        name="weeklyTarget"
        value={profile.weeklyTarget}
        label={t("islamic.weekly")}
        span
      />
      <TextField
        name="nextLessonTarget"
        value={profile.nextLessonTarget}
        label={t("islamic.next")}
        span
      />
      <label className="grid gap-1 text-sm font-semibold text-muted">
        {t("islamic.comment")}
        <textarea
          name="comment"
          rows={3}
          className={`${fieldClass} min-h-24 py-3`}
        />
      </label>
      <Button type="submit" disabled={pending}>
        {t("islamic.save")}
      </Button>
    </form>
  );
}

export function IslamicStudiesProgressDeskView({
  desk,
}: {
  desk: IslamicStudiesProgressDesk;
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
      const next = await postJson<IslamicStudiesProgressDesk>(
        "/api/v1/progress/islamic-studies",
        body,
      );
      setCurrent(next);
      setMessage(t("islamic.saved"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("islamic.failed"));
    } finally {
      setPending(false);
    }
  }

  const place =
    profile &&
    [
      profile.courseTitle || null,
      profile.levelLabel || null,
      profile.unitLabel || null,
      profile.lessonLabel || null,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <div className="space-y-8">
      {current.learners.length > 1 ? (
        <p className="text-sm font-semibold">
          {t("islamic.choose")}
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
              {t("islamic.for", { name: profile.studentName })}
            </p>
            <h2 className="font-heading mt-2 text-3xl font-bold tracking-tight text-brand">
              {t("islamic.course_place")}
            </h2>
            <p className="mt-3 text-lg text-brand">
              {place || t("islamic.none.place")}
            </p>
            <div className="mt-5 rounded-2xl bg-[#F3E6D0] px-4 py-4">
              <Bar label={t("islamic.completion")} value={profile.completionPercent} />
            </div>
            <dl className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
              {profile.courseTitle ? (
                <div>
                  <dt className="font-semibold text-muted">{t("islamic.course")}</dt>
                  <dd className="text-brand">{profile.courseTitle}</dd>
                </div>
              ) : null}
              {profile.levelLabel ? (
                <div>
                  <dt className="font-semibold text-muted">{t("islamic.level")}</dt>
                  <dd className="text-brand">{profile.levelLabel}</dd>
                </div>
              ) : null}
              {profile.unitLabel ? (
                <div>
                  <dt className="font-semibold text-muted">{t("islamic.unit")}</dt>
                  <dd className="text-brand">{profile.unitLabel}</dd>
                </div>
              ) : null}
              {profile.lessonLabel ? (
                <div>
                  <dt className="font-semibold text-muted">{t("islamic.lesson")}</dt>
                  <dd className="text-brand">{profile.lessonLabel}</dd>
                </div>
              ) : null}
              {profile.weeklyTarget ? (
                <div>
                  <dt className="font-semibold text-muted">{t("islamic.weekly")}</dt>
                  <dd className="text-brand">{profile.weeklyTarget}</dd>
                </div>
              ) : null}
              {profile.nextLessonTarget ? (
                <div>
                  <dt className="font-semibold text-muted">{t("islamic.next")}</dt>
                  <dd className="text-brand">{profile.nextLessonTarget}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <article className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
                {t("islamic.homework")}
              </p>
              <p className="font-heading mt-2 text-2xl font-bold tracking-tight text-brand">
                {profile.homeworkStatus
                  ? t(homeworkKeys[profile.homeworkStatus])
                  : t("islamic.none.homework")}
              </p>
            </article>
            <article className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
                {t("islamic.assessment")}
              </p>
              <p className="font-heading mt-2 text-2xl font-bold tracking-tight text-brand">
                {profile.assessmentStatus
                  ? t(assessmentKeys[profile.assessmentStatus])
                  : t("islamic.none.assessment")}
              </p>
            </article>
          </section>

          <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
              {t("islamic.comments")}
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
              <p className="mt-3 text-sm text-muted">{t("islamic.none.comments")}</p>
            )}
            {current.canEdit ? (
              <IslamicStudiesForm
                profile={profile}
                pending={pending}
                onSave={onSave}
              />
            ) : null}
          </section>
        </>
      ) : (
        <p className="rounded-[2rem] border border-line bg-surface px-5 py-4 text-sm text-muted">
          {current.learners.length ? t("islamic.pick") : t("islamic.none.learners")}
        </p>
      )}
    </div>
  );
}
