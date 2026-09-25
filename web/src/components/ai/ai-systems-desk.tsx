"use client";

import { useState, type FormEvent } from "react";
import { useLessonSpeechCapture } from "@/components/ai/ai-speech-capture";
import { Button } from "@/components/ui/button";
import { useI18n, useT } from "@/components/i18n/i18n-provider";
import { fieldClass, getJson, postForm, postJson } from "@/lib/api";
import { aiUploadAccept } from "@/lib/ai-uploads";
import type { UiMessageKey } from "@/lib/i18n";
import {
  AI_LOCALES,
  AI_SPEAKER_ROLES,
  classroomRecordingPlaybackHref,
  highlightTranscriptParts,
  speakerKey,
  speakerToneClass,
  type AiContentOrigin,
  type AiJobKind,
  type AiJobStatus,
  type AiLocale,
  type AiSpeakerRole,
  type AiTranscriptSource,
} from "@/lib/ai-systems";
import type {
  AiClassroomOption,
  AiHomeworkView,
  AiNoteView,
  AiQuizView,
  AiRecommendationView,
  AiReviewItem,
  AiSummaryView,
  AiSystemsDesk,
  AiTranscriptView,
} from "@/server/ai/service";

const kindKeys: Record<AiJobKind, UiMessageKey> = {
  transcription: "ai.kind.transcription",
  summary: "ai.kind.summary",
  notes: "ai.kind.notes",
  homework: "ai.kind.homework",
  quiz: "ai.kind.quiz",
  recommendation: "ai.kind.recommendation",
  search: "ai.kind.search",
};

const kindHelpKeys: Record<AiJobKind, UiMessageKey> = {
  transcription: "ai.kind.help.transcription",
  summary: "ai.kind.help.summary",
  notes: "ai.kind.help.notes",
  homework: "ai.kind.help.homework",
  quiz: "ai.kind.help.quiz",
  recommendation: "ai.kind.help.recommendation",
  search: "ai.kind.help.search",
};

const statusKeys: Record<AiJobStatus, UiMessageKey> = {
  queued: "ai.status.queued",
  processing: "ai.status.processing",
  ready: "ai.status.ready",
  needs_review: "ai.status.needs_review",
  approved: "ai.status.approved",
  rejected: "ai.status.rejected",
  failed: "ai.status.failed",
};

const speakerKeys: Record<AiSpeakerRole, UiMessageKey> = {
  teacher: "ai.speaker.teacher",
  student: "ai.speaker.student",
  parent: "ai.speaker.parent",
  staff: "ai.speaker.staff",
  unknown: "ai.speaker.unknown",
};

const sourceKeys: Record<AiTranscriptSource, UiMessageKey> = {
  speech: "ai.source.speech",
  chat: "ai.source.chat",
  typed: "ai.source.typed",
  mixed: "ai.source.mixed",
};

function reviewPublishKey(status: AiJobStatus, publishedAt?: string | null) {
  if (status === "approved" || publishedAt) return "ai.review.published" as const;
  if (status === "needs_review" || status === "processing") {
    return "ai.review.unpublished" as const;
  }
  return null;
}

function originLabelKey(origin?: AiContentOrigin | null) {
  if (origin === "ai") return "ai.identify.ai" as const;
  if (origin === "ai_assisted") return "ai.identify.assisted" as const;
  return null;
}

function AiOriginMark({ origin }: { origin?: AiContentOrigin | null }) {
  const t = useT();
  const key = originLabelKey(origin);
  if (!key) return null;
  return <span>{` · ${t(key)}`}</span>;
}

export function AiSystemsDeskView({ desk }: { desk: AiSystemsDesk }) {
  const t = useT();
  const { locale: uiLocale } = useI18n();
  const [current, setCurrent] = useState(desk);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState(desk.query);
  const [language, setLanguage] = useState<AiLocale | "all">(
    uiLocale.startsWith("ar") ? "ar" : "en",
  );
  const [openId, setOpenId] = useState<string | null>(
    desk.transcripts.find((item) => item.locale === "en")?.id ??
      desk.transcripts[0]?.id ??
      null,
  );

  async function fetchDesk(nextQuery = query) {
    const params = new URLSearchParams();
    const q = nextQuery.trim();
    if (q) params.set("q", q);
    if (current.studentUserId) params.set("studentUserId", current.studentUserId);
    const suffix = params.toString();
    return getJson<AiSystemsDesk>(suffix ? `/api/v1/ai?${suffix}` : "/api/v1/ai");
  }

  async function run(body: unknown) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      let next = await postJson<AiSystemsDesk>("/api/v1/ai", body);
      if (query.trim()) next = await fetchDesk(query);
      setCurrent(next);
      setMessage(t("ai.saved"));
      const first = next.transcripts.find((item) => item.matchCount > 0) ?? next.transcripts[0];
      if (first) setOpenId(first.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("ai.failed"));
    } finally {
      setPending(false);
    }
  }

  async function runUpload(form: HTMLFormElement) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      let next = await postForm<AiSystemsDesk>("/api/v1/ai/uploads", new FormData(form));
      if (query.trim()) next = await fetchDesk(query);
      setCurrent(next);
      setMessage(t("ai.saved"));
      form.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("ai.failed"));
    } finally {
      setPending(false);
    }
  }

  async function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    try {
      const next = await fetchDesk(query);
      setCurrent(next);
      const first = next.transcripts.find((item) => item.matchCount > 0) ?? next.transcripts[0];
      setOpenId(first?.id ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("ai.search.failed"));
    } finally {
      setPending(false);
    }
  }

  async function onTranscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const classroomId = String(data.classroomId ?? "");
    const room = current.classrooms.find((item) => item.id === classroomId);
    await run({
      action: "transcribe",
      classroomId,
      recordingId: room?.recordingId ?? "",
      locale: String(data.locale ?? ""),
    });
  }

  async function onSaveText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const classroomId = String(data.classroomId ?? "");
    const room = current.classrooms.find((item) => item.id === classroomId);
    await run({
      action: "save_text",
      classroomId,
      recordingId: room?.recordingId ?? "",
      locale: String(data.locale ?? ""),
      body: String(data.body ?? ""),
    });
  }

  const shown =
    language === "all"
      ? current.transcripts
      : current.transcripts.filter((item) => item.locale === language);
  const shownSummaries =
    language === "all"
      ? current.summaries ?? []
      : (current.summaries ?? []).filter((item) => item.locale === language);
  const shownNotes =
    language === "all"
      ? current.notes ?? []
      : (current.notes ?? []).filter((item) => item.locale === language);
  const shownHomework =
    language === "all"
      ? current.homeworks ?? []
      : (current.homeworks ?? []).filter((item) => item.locale === language);
  const shownQuizzes =
    language === "all"
      ? current.quizzes ?? []
      : (current.quizzes ?? []).filter((item) => item.locale === language);
  const shownRecommendations =
    language === "all"
      ? current.recommendations ?? []
      : (current.recommendations ?? []).filter((item) => item.locale === language);
  const shownReviewQueue =
    language === "all"
      ? current.reviewQueue ?? []
      : (current.reviewQueue ?? []).filter((item) => item.locale === language);

  return (
    <div className="space-y-8">
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="text-sm text-brand">{message}</p> : null}

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
            {t("ai.module.live")}
          </p>
          <h2 className="font-heading mt-2 text-2xl font-bold tracking-tight text-brand">
            {t("ai.english.title")}
          </h2>
          <p className="mt-2 text-sm text-muted">{t("ai.english.help")}</p>
        </article>
        <article className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
            {t("ai.module.live")}
          </p>
          <h2 className="font-heading mt-2 text-2xl font-bold tracking-tight text-brand">
            {t("ai.arabic.title")}
          </h2>
          <p className="mt-2 text-sm text-muted">{t("ai.arabic.help")}</p>
        </article>
      </section>

      <section className="rounded-[2rem] border border-line bg-[#F3E6D0] p-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
          {t("ai.module.live")}
        </p>
        <h2 className="font-heading mt-2 text-2xl font-bold tracking-tight text-brand">
          {t("ai.safety.title")}
        </h2>
        <p className="mt-2 text-sm text-muted">{t("ai.safety.help")}</p>
        <ul className="mt-3 grid gap-2 text-sm text-brand">
          <li>{t("ai.safety.labelled")}</li>
          <li>{t("ai.safety.review")}</li>
          <li>{t("ai.safety.academic")}</li>
          <li>{t("ai.safety.safeguarding")}</li>
          <li>{t("ai.safety.contact")}</li>
          <li>{t("ai.safety.payment")}</li>
          <li>{t("ai.safety.extractive")}</li>
          <li>{t("ai.safety.notes")}</li>
        </ul>
      </section>

      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
          {t("ai.module.live")}
        </p>
        <h2 className="font-heading mt-2 text-2xl font-bold tracking-tight text-brand">
          {t("ai.decisions.title")}
        </h2>
        <p className="mt-2 text-sm text-muted">{t("ai.decisions.help")}</p>
        <ul className="mt-3 grid gap-2 text-sm text-brand">
          <li>{t("ai.decisions.marks")}</li>
          <li>{t("ai.decisions.pass_fail")}</li>
          <li>{t("ai.decisions.certificates")}</li>
          <li>{t("ai.decisions.progress")}</li>
          <li>{t("ai.decisions.incidents")}</li>
          <li>{t("ai.decisions.suspend")}</li>
          <li>{t("ai.decisions.human")}</li>
        </ul>
      </section>

      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
          {t("ai.module.live")}
        </p>
        <h2 className="font-heading mt-2 text-2xl font-bold tracking-tight text-brand">
          {t("ai.review.title")}
        </h2>
        <p className="mt-2 text-sm text-muted">{t("ai.review.help")}</p>
        {current.canEdit ? (
          <>
            <p className="mt-3 text-sm font-semibold text-brand">
              {shownReviewQueue.length
                ? t("ai.review.count", { n: shownReviewQueue.length })
                : t("ai.review.empty")}
            </p>
            {shownReviewQueue.length ? (
              <div className="mt-4 grid gap-4">
                {shownReviewQueue.map((item) => (
                  <ReviewQueueCard
                    key={item.jobId}
                    item={item}
                    pending={pending}
                    onReview={(decision, note) =>
                      run({ action: "review", jobId: item.jobId, decision, note })
                    }
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-sm text-brand">
            {t(
              current.actorRole === "parent" || current.studentUserId
                ? "ai.review.family"
                : "ai.review.learner",
            )}
          </p>
        )}
      </section>

      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
          {t("ai.module.live")}
        </p>
        <h2 className="font-heading mt-2 text-2xl font-bold tracking-tight text-brand">
          {t("ai.identify.title")}
        </h2>
        <p className="mt-2 text-sm text-muted">{t("ai.identify.help")}</p>
        <ul className="mt-3 grid gap-2 text-sm text-brand">
          <li>{t("ai.identify.ai")}</li>
          <li>{t("ai.identify.assisted")}</li>
          <li>{t("ai.identify.human")}</li>
        </ul>
        <p className="mt-3 text-sm text-muted">{t("ai.identify.legend")}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {current.modules.map((module) => (
          <article
            key={module.kind}
            className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
          >
            <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
              {module.live ? t("ai.module.live") : t("ai.module.planned")}
            </p>
            <h3 className="font-heading mt-2 text-xl font-bold tracking-tight text-brand">
              {t(kindKeys[module.kind])}
            </h3>
            <p className="mt-2 text-sm text-muted">{t(kindHelpKeys[module.kind])}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
          {t("ai.module.live")}
        </p>
        <h2 className="font-heading mt-2 text-2xl font-bold tracking-tight text-brand">
          {t("ai.search.title")}
        </h2>
        <p className="mt-2 text-sm text-muted">{t("ai.search.help")}</p>
        <form className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={onSearch}>
          <label className="grid gap-1 text-sm font-semibold text-muted">
            {t("ai.search.label")}
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={fieldClass}
              placeholder={t("ai.search.placeholder")}
            />
          </label>
          <Button type="submit" className="sm:mt-6" disabled={pending}>
            {t("ai.search.submit")}
          </Button>
        </form>
        {current.query ? (
          <p className="mt-3 text-sm text-muted">
            {t("ai.search.results", {
              n:
                shown.length +
                shownSummaries.length +
                shownNotes.length +
                shownHomework.length +
                shownQuizzes.length +
                shownRecommendations.length,
              q: current.query,
            })}
          </p>
        ) : null}
      </section>

      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
          {t("ai.module.live")}
        </p>
        <h2 className="font-heading mt-2 text-2xl font-bold tracking-tight text-brand">
          {t("ai.speakers.title")}
        </h2>
        <p className="mt-2 text-sm text-muted">{t("ai.speakers.help")}</p>
      </section>

      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
          {t("ai.module.live")}
        </p>
        <h2 className="font-heading mt-2 text-2xl font-bold tracking-tight text-brand">
          {t("ai.summary.title")}
        </h2>
        <p className="mt-2 text-sm text-muted">{t("ai.summary.help")}</p>
        <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
          {t("ai.points.title")}
        </p>
        <p className="mt-1 text-sm text-muted">{t("ai.points.help")}</p>
        <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
          {t("ai.vocab.title")}
        </p>
        <p className="mt-1 text-sm text-muted">{t("ai.vocab.help")}</p>
        <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
          {t("ai.improve.title")}
        </p>
        <p className="mt-1 text-sm text-muted">{t("ai.improve.help")}</p>
        <p className="mt-3 text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
          {t("ai.next.title")}
        </p>
        <p className="mt-1 text-sm text-muted">{t("ai.next.help")}</p>
        {current.canEdit && current.transcripts.length ? (
          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const data = Object.fromEntries(new FormData(event.currentTarget).entries());
                void run({
                  action: "summarise",
                  transcriptJobId: String(data.transcriptJobId ?? ""),
                });
              }}
            >
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.summary.transcript")}
                <select name="transcriptJobId" className={fieldClass} required>
                  {current.transcripts.map((item) => (
                    <option key={item.jobId} value={item.jobId}>
                      {item.classroomTitle}
                      {` · ${t(item.locale === "ar" ? "ai.locale.ar" : "ai.locale.en")}`}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" disabled={pending}>
                {t("ai.summary.submit")}
              </Button>
            </form>
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const data = Object.fromEntries(new FormData(event.currentTarget).entries());
                const transcript = current.transcripts.find(
                  (item) => item.jobId === String(data.transcriptJobId ?? ""),
                );
                void run({
                  action: "save_summary",
                  classroomId: transcript?.classroomId ?? current.classrooms[0]?.id ?? "",
                  transcriptJobId: String(data.transcriptJobId ?? ""),
                  locale: transcript?.locale ?? "en",
                  body: String(data.body ?? ""),
                  keyPoints: String(data.keyPoints ?? ""),
                  vocabulary: String(data.vocabulary ?? ""),
                  improvementAreas: String(data.improvementAreas ?? ""),
                  nextLessonRecommendations: String(data.nextLessonRecommendations ?? ""),
                });
              }}
            >
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.summary.transcript")}
                <select name="transcriptJobId" className={fieldClass} required>
                  {current.transcripts.map((item) => (
                    <option key={item.jobId} value={item.jobId}>
                      {item.classroomTitle}
                      {` · ${t(item.locale === "ar" ? "ai.locale.ar" : "ai.locale.en")}`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.summary.typed")}
                <textarea
                  name="body"
                  rows={5}
                  required
                  minLength={20}
                  className={`${fieldClass} min-h-28 py-3`}
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.points.label")}
                <textarea
                  name="keyPoints"
                  rows={4}
                  className={`${fieldClass} min-h-24 py-3`}
                  placeholder={t("ai.points.placeholder")}
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.vocab.label")}
                <textarea
                  name="vocabulary"
                  rows={4}
                  className={`${fieldClass} min-h-24 py-3`}
                  placeholder={t("ai.vocab.placeholder")}
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.improve.label")}
                <textarea
                  name="improvementAreas"
                  rows={4}
                  className={`${fieldClass} min-h-24 py-3`}
                  placeholder={t("ai.improve.placeholder")}
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.next.label")}
                <textarea
                  name="nextLessonRecommendations"
                  rows={4}
                  className={`${fieldClass} min-h-24 py-3`}
                  placeholder={t("ai.next.placeholder")}
                />
              </label>
              <Button type="submit" disabled={pending} variant="secondary">
                {t("ai.summary.typed.submit")}
              </Button>
            </form>
          </div>
        ) : current.canEdit ? (
          <p className="mt-4 text-sm text-muted">{t("ai.none.transcripts")}</p>
        ) : null}
      </section>

      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
          {t("ai.module.live")}
        </p>
        <h2 className="font-heading mt-2 text-2xl font-bold tracking-tight text-brand">
          {t("ai.notes.title")}
        </h2>
        <p className="mt-2 text-sm text-muted">{t("ai.notes.help")}</p>
        {current.canWriteNotes && current.classrooms.length ? (
          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const data = Object.fromEntries(new FormData(event.currentTarget).entries());
                void run({
                  action: "save_typed_notes",
                  classroomId: String(data.classroomId ?? ""),
                  locale: String(data.locale ?? "") || undefined,
                  body: String(data.body ?? ""),
                });
              }}
            >
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.notes.lesson")}
                <select name="classroomId" className={fieldClass} required>
                  {current.classrooms.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.locale")}
                <select name="locale" className={fieldClass} defaultValue={uiLocale.startsWith("ar") ? "ar" : "en"}>
                  {AI_LOCALES.map((item) => (
                    <option key={item} value={item}>
                      {t(item === "ar" ? "ai.locale.ar" : "ai.locale.en")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.notes.typed")}
                <textarea
                  name="body"
                  rows={5}
                  required
                  minLength={8}
                  className={`${fieldClass} min-h-28 py-3`}
                  placeholder={t("ai.notes.placeholder")}
                />
              </label>
              <Button type="submit" disabled={pending}>
                {t("ai.notes.typed.submit")}
              </Button>
            </form>
            {current.transcripts.length ? (
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
                  void run({
                    action: "save_notes",
                    transcriptJobId: String(data.transcriptJobId ?? ""),
                  });
                }}
              >
                <label className="grid gap-1 text-sm font-semibold text-muted">
                  {t("ai.notes.transcript")}
                  <select name="transcriptJobId" className={fieldClass} required>
                    {current.transcripts.map((item) => (
                      <option key={item.jobId} value={item.jobId}>
                        {item.classroomTitle}
                        {` · ${t(item.locale === "ar" ? "ai.locale.ar" : "ai.locale.en")}`}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" disabled={pending} variant="secondary">
                  {t("ai.notes.submit")}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted">{t("ai.notes.none_transcript")}</p>
            )}
          </div>
        ) : current.canWriteNotes ? (
          <p className="mt-4 text-sm text-muted">{t("ai.notes.none_lesson")}</p>
        ) : (
          <p className="mt-4 text-sm text-muted">{t("ai.notes.private")}</p>
        )}
      </section>

      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
          {t("ai.module.live")}
        </p>
        <h2 className="font-heading mt-2 text-2xl font-bold tracking-tight text-brand">
          {t("ai.homework.title")}
        </h2>
        <p className="mt-2 text-sm text-muted">{t("ai.homework.help")}</p>
        {current.canEdit && current.classrooms.length ? (
          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const data = Object.fromEntries(new FormData(event.currentTarget).entries());
                void run({
                  action: "save_typed_homework",
                  classroomId: String(data.classroomId ?? ""),
                  locale: String(data.locale ?? "") || undefined,
                  title: String(data.title ?? ""),
                  body: String(data.body ?? ""),
                  tasks: String(data.tasks ?? ""),
                });
              }}
            >
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.homework.lesson")}
                <select name="classroomId" className={fieldClass} required>
                  {current.classrooms.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.locale")}
                <select name="locale" className={fieldClass} defaultValue={uiLocale.startsWith("ar") ? "ar" : "en"}>
                  {AI_LOCALES.map((item) => (
                    <option key={item} value={item}>
                      {t(item === "ar" ? "ai.locale.ar" : "ai.locale.en")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.homework.name")}
                <input name="title" required minLength={2} className={fieldClass} />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.homework.typed")}
                <textarea
                  name="body"
                  rows={5}
                  required
                  minLength={20}
                  className={`${fieldClass} min-h-28 py-3`}
                  placeholder={t("ai.homework.placeholder")}
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.homework.tasks")}
                <textarea
                  name="tasks"
                  rows={4}
                  className={`${fieldClass} min-h-24 py-3`}
                  placeholder={t("ai.homework.tasks.placeholder")}
                />
              </label>
              <Button type="submit" disabled={pending}>
                {t("ai.homework.typed.submit")}
              </Button>
            </form>
            {current.transcripts.length ? (
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
                  void run({
                    action: "generate_homework",
                    transcriptJobId: String(data.transcriptJobId ?? ""),
                  });
                }}
              >
                <label className="grid gap-1 text-sm font-semibold text-muted">
                  {t("ai.homework.transcript")}
                  <select name="transcriptJobId" className={fieldClass} required>
                    {current.transcripts.map((item) => (
                      <option key={item.jobId} value={item.jobId}>
                        {item.classroomTitle}
                        {` · ${t(item.locale === "ar" ? "ai.locale.ar" : "ai.locale.en")}`}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" disabled={pending} variant="secondary">
                  {t("ai.homework.submit")}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted">{t("ai.homework.none_transcript")}</p>
            )}
          </div>
        ) : current.canEdit ? (
          <p className="mt-4 text-sm text-muted">{t("ai.homework.none_lesson")}</p>
        ) : (
          <p className="mt-4 text-sm text-muted">{t("ai.homework.review")}</p>
        )}
      </section>

      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
          {t("ai.module.live")}
        </p>
        <h2 className="font-heading mt-2 text-2xl font-bold tracking-tight text-brand">
          {t("ai.quiz.title")}
        </h2>
        <p className="mt-2 text-sm text-muted">{t("ai.quiz.help")}</p>
        {current.canEdit && current.classrooms.length ? (
          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            {current.transcripts.length ? (
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
                  void run({
                    action: "generate_quiz_lesson",
                    transcriptJobId: String(data.transcriptJobId ?? ""),
                  });
                }}
              >
                <p className="text-sm font-semibold text-brand">{t("ai.quiz.source.lesson")}</p>
                <label className="grid gap-1 text-sm font-semibold text-muted">
                  {t("ai.quiz.transcript")}
                  <select name="transcriptJobId" className={fieldClass} required>
                    {current.transcripts.map((item) => (
                      <option key={item.jobId} value={item.jobId}>
                        {item.classroomTitle}
                        {` · ${t(item.locale === "ar" ? "ai.locale.ar" : "ai.locale.en")}`}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" disabled={pending}>
                  {t("ai.quiz.submit.lesson")}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted">{t("ai.quiz.none_transcript")}</p>
            )}
            {(current.books ?? []).length ? (
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
                  void run({
                    action: "generate_quiz_book",
                    materialId: String(data.materialId ?? ""),
                    classroomId: String(data.classroomId ?? ""),
                    locale: String(data.locale ?? "") || undefined,
                  });
                }}
              >
                <p className="text-sm font-semibold text-brand">{t("ai.quiz.source.book")}</p>
                <label className="grid gap-1 text-sm font-semibold text-muted">
                  {t("ai.quiz.book")}
                  <select name="materialId" className={fieldClass} required>
                    {(current.books ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold text-muted">
                  {t("ai.quiz.lesson")}
                  <select name="classroomId" className={fieldClass} required>
                    {current.classrooms.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold text-muted">
                  {t("ai.locale")}
                  <select name="locale" className={fieldClass} defaultValue={uiLocale.startsWith("ar") ? "ar" : "en"}>
                    {AI_LOCALES.map((item) => (
                      <option key={item} value={item}>
                        {t(item === "ar" ? "ai.locale.ar" : "ai.locale.en")}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" disabled={pending} variant="secondary">
                  {t("ai.quiz.submit.book")}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted">{t("ai.quiz.none_book")}</p>
            )}
            {(current.topics ?? []).length ? (
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
                  void run({
                    action: "generate_quiz_topic",
                    topic: String(data.topic ?? ""),
                    classroomId: String(data.classroomId ?? ""),
                    locale: String(data.locale ?? "") || undefined,
                  });
                }}
              >
                <p className="text-sm font-semibold text-brand">{t("ai.quiz.source.topic")}</p>
                <label className="grid gap-1 text-sm font-semibold text-muted">
                  {t("ai.quiz.topic")}
                  <select name="topic" className={fieldClass} required>
                    {(current.topics ?? []).map((item) => (
                      <option key={item.topic} value={item.topic}>
                        {item.topic}
                        {` · ${t("ai.quiz.topic.count", { n: item.count })}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold text-muted">
                  {t("ai.quiz.lesson")}
                  <select name="classroomId" className={fieldClass} required>
                    {current.classrooms.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold text-muted">
                  {t("ai.locale")}
                  <select name="locale" className={fieldClass} defaultValue={uiLocale.startsWith("ar") ? "ar" : "en"}>
                    {AI_LOCALES.map((item) => (
                      <option key={item} value={item}>
                        {t(item === "ar" ? "ai.locale.ar" : "ai.locale.en")}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" disabled={pending} variant="secondary">
                  {t("ai.quiz.submit.topic")}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted">{t("ai.quiz.none_topic")}</p>
            )}
            {(current.uploads ?? []).length ? (
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
                  void run({
                    action: "generate_quiz_upload",
                    fileId: String(data.fileId ?? ""),
                    classroomId: String(data.classroomId ?? ""),
                    locale: String(data.locale ?? "") || undefined,
                  });
                }}
              >
                <p className="text-sm font-semibold text-brand">{t("ai.quiz.source.upload")}</p>
                <label className="grid gap-1 text-sm font-semibold text-muted">
                  {t("ai.quiz.document.existing")}
                  <select name="fileId" className={fieldClass} required>
                    {(current.uploads ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.classroomTitle ? `${item.name} · ${item.classroomTitle}` : item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold text-muted">
                  {t("ai.quiz.lesson")}
                  <select name="classroomId" className={fieldClass} required>
                    {current.classrooms.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold text-muted">
                  {t("ai.locale")}
                  <select name="locale" className={fieldClass} defaultValue={uiLocale.startsWith("ar") ? "ar" : "en"}>
                    {AI_LOCALES.map((item) => (
                      <option key={item} value={item}>
                        {t(item === "ar" ? "ai.locale.ar" : "ai.locale.en")}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" disabled={pending} variant="secondary">
                  {t("ai.quiz.submit.upload")}
                </Button>
              </form>
            ) : null}
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void runUpload(event.currentTarget);
              }}
            >
              <p className="text-sm font-semibold text-brand">{t("ai.quiz.source.upload")}</p>
              <p className="text-sm text-muted">{t("ai.quiz.upload.help")}</p>
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.quiz.document")}
                <input
                  name="file"
                  type="file"
                  required
                  accept={aiUploadAccept()}
                  className={fieldClass}
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.quiz.lesson")}
                <select name="classroomId" className={fieldClass} required>
                  {current.classrooms.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.locale")}
                <select name="locale" className={fieldClass} defaultValue={uiLocale.startsWith("ar") ? "ar" : "en"}>
                  {AI_LOCALES.map((item) => (
                    <option key={item} value={item}>
                      {t(item === "ar" ? "ai.locale.ar" : "ai.locale.en")}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" disabled={pending}>
                {t("ai.quiz.submit.upload")}
              </Button>
            </form>
            {(current.previousLessons ?? []).length > 0 && current.classrooms.length > 1 ? (
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
                  void run({
                    action: "generate_quiz_previous",
                    previousClassroomId: String(data.previousClassroomId ?? ""),
                    classroomId: String(data.classroomId ?? ""),
                    locale: String(data.locale ?? "") || undefined,
                  });
                }}
              >
                <p className="text-sm font-semibold text-brand">{t("ai.quiz.source.previous")}</p>
                <p className="text-sm text-muted">{t("ai.quiz.previous.help")}</p>
                <label className="grid gap-1 text-sm font-semibold text-muted">
                  {t("ai.quiz.previous")}
                  <select name="previousClassroomId" className={fieldClass} required>
                    {(current.previousLessons ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                        {` · ${t(item.locale === "ar" ? "ai.locale.ar" : "ai.locale.en")}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold text-muted">
                  {t("ai.quiz.lesson")}
                  <select name="classroomId" className={fieldClass} required>
                    {current.classrooms.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold text-muted">
                  {t("ai.locale")}
                  <select name="locale" className={fieldClass} defaultValue={uiLocale.startsWith("ar") ? "ar" : "en"}>
                    {AI_LOCALES.map((item) => (
                      <option key={item} value={item}>
                        {t(item === "ar" ? "ai.locale.ar" : "ai.locale.en")}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" disabled={pending} variant="secondary">
                  {t("ai.quiz.submit.previous")}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted">{t("ai.quiz.none_previous")}</p>
            )}
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const data = Object.fromEntries(new FormData(event.currentTarget).entries());
                void run({
                  action: "save_typed_quiz",
                  classroomId: String(data.classroomId ?? ""),
                  locale: String(data.locale ?? "") || undefined,
                  title: String(data.title ?? ""),
                  body: String(data.body ?? ""),
                  questions: String(data.questions ?? ""),
                });
              }}
            >
              <p className="text-sm font-semibold text-brand">{t("ai.quiz.typed")}</p>
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.quiz.lesson")}
                <select name="classroomId" className={fieldClass} required>
                  {current.classrooms.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.locale")}
                <select name="locale" className={fieldClass} defaultValue={uiLocale.startsWith("ar") ? "ar" : "en"}>
                  {AI_LOCALES.map((item) => (
                    <option key={item} value={item}>
                      {t(item === "ar" ? "ai.locale.ar" : "ai.locale.en")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.quiz.name")}
                <input name="title" required minLength={2} className={fieldClass} />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.quiz.instructions")}
                <textarea
                  name="body"
                  rows={4}
                  required
                  minLength={20}
                  className={`${fieldClass} min-h-24 py-3`}
                  placeholder={t("ai.quiz.placeholder")}
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.quiz.questions")}
                <textarea
                  name="questions"
                  rows={4}
                  required
                  className={`${fieldClass} min-h-24 py-3`}
                  placeholder={t("ai.quiz.questions.placeholder")}
                />
              </label>
              <Button type="submit" disabled={pending}>
                {t("ai.quiz.typed.submit")}
              </Button>
            </form>
          </div>
        ) : current.canEdit ? (
          <p className="mt-4 text-sm text-muted">{t("ai.quiz.none_lesson")}</p>
        ) : (
          <p className="mt-4 text-sm text-muted">{t("ai.quiz.review")}</p>
        )}
      </section>

      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
          {t("ai.module.live")}
        </p>
        <h2 className="font-heading mt-2 text-2xl font-bold tracking-tight text-brand">
          {t("ai.recommend.title")}
        </h2>
        <p className="mt-2 text-sm text-muted">{t("ai.recommend.help")}</p>
        {current.canEdit && current.classrooms.length ? (
          <div className="mt-6 grid gap-8 lg:grid-cols-2">
            {current.transcripts.length ? (
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
                  void run({
                    action: "generate_recommendation",
                    transcriptJobId: String(data.transcriptJobId ?? ""),
                  });
                }}
              >
                <p className="text-sm font-semibold text-brand">{t("ai.recommend.source.lesson")}</p>
                <label className="grid gap-1 text-sm font-semibold text-muted">
                  {t("ai.recommend.transcript")}
                  <select name="transcriptJobId" className={fieldClass} required>
                    {current.transcripts.map((item) => (
                      <option key={item.jobId} value={item.jobId}>
                        {item.classroomTitle}
                        {` · ${t(item.locale === "ar" ? "ai.locale.ar" : "ai.locale.en")}`}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" disabled={pending}>
                  {t("ai.recommend.submit.lesson")}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted">{t("ai.recommend.none_transcript")}</p>
            )}
            {(current.previousLessons ?? []).length > 0 && current.classrooms.length > 1 ? (
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
                  void run({
                    action: "generate_recommendation_previous",
                    previousClassroomId: String(data.previousClassroomId ?? ""),
                    classroomId: String(data.classroomId ?? ""),
                    locale: String(data.locale ?? "") || undefined,
                  });
                }}
              >
                <p className="text-sm font-semibold text-brand">{t("ai.recommend.source.previous")}</p>
                <p className="text-sm text-muted">{t("ai.recommend.previous.help")}</p>
                <label className="grid gap-1 text-sm font-semibold text-muted">
                  {t("ai.recommend.previous")}
                  <select name="previousClassroomId" className={fieldClass} required>
                    {(current.previousLessons ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                        {` · ${t(item.locale === "ar" ? "ai.locale.ar" : "ai.locale.en")}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold text-muted">
                  {t("ai.recommend.lesson")}
                  <select name="classroomId" className={fieldClass} required>
                    {current.classrooms.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold text-muted">
                  {t("ai.locale")}
                  <select name="locale" className={fieldClass} defaultValue={uiLocale.startsWith("ar") ? "ar" : "en"}>
                    {AI_LOCALES.map((item) => (
                      <option key={item} value={item}>
                        {t(item === "ar" ? "ai.locale.ar" : "ai.locale.en")}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" disabled={pending} variant="secondary">
                  {t("ai.recommend.submit.previous")}
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted">{t("ai.recommend.none_previous")}</p>
            )}
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const data = Object.fromEntries(new FormData(event.currentTarget).entries());
                void run({
                  action: "save_typed_recommendation",
                  classroomId: String(data.classroomId ?? ""),
                  locale: String(data.locale ?? "") || undefined,
                  title: String(data.title ?? ""),
                  body: String(data.body ?? ""),
                  items: String(data.items ?? ""),
                });
              }}
            >
              <p className="text-sm font-semibold text-brand">{t("ai.recommend.typed")}</p>
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.recommend.lesson")}
                <select name="classroomId" className={fieldClass} required>
                  {current.classrooms.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.locale")}
                <select name="locale" className={fieldClass} defaultValue={uiLocale.startsWith("ar") ? "ar" : "en"}>
                  {AI_LOCALES.map((item) => (
                    <option key={item} value={item}>
                      {t(item === "ar" ? "ai.locale.ar" : "ai.locale.en")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.recommend.name")}
                <input name="title" required minLength={2} className={fieldClass} />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.recommend.instructions")}
                <textarea
                  name="body"
                  rows={4}
                  required
                  minLength={20}
                  className={`${fieldClass} min-h-24 py-3`}
                  placeholder={t("ai.recommend.placeholder")}
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold text-muted">
                {t("ai.recommend.items")}
                <textarea
                  name="items"
                  rows={4}
                  required
                  className={`${fieldClass} min-h-24 py-3`}
                  placeholder={t("ai.recommend.items.placeholder")}
                />
              </label>
              <Button type="submit" disabled={pending}>
                {t("ai.recommend.typed.submit")}
              </Button>
            </form>
          </div>
        ) : current.canEdit ? (
          <p className="mt-4 text-sm text-muted">{t("ai.recommend.none_lesson")}</p>
        ) : (
          <p className="mt-4 text-sm text-muted">{t("ai.recommend.review")}</p>
        )}
      </section>

      {current.canEdit ? (
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
            {t("ai.speech.title")}
          </h2>
          <p className="mt-2 text-sm text-muted">{t("ai.speech.help")}</p>
          {current.classrooms.length ? (
            <SpeechTranscriptForm
              classrooms={current.classrooms}
              pending={pending}
              onSave={(body) => run(body)}
              defaultLocale={uiLocale.startsWith("ar") ? "ar" : "en"}
              actorName={current.actorName}
              actorRole={current.actorRole}
              actorUserId={current.actorUserId}
            />
          ) : (
            <p className="mt-4 text-sm text-muted">{t("ai.none.lessons")}</p>
          )}
        </section>
      ) : null}

      {current.canEdit ? (
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
            {t("ai.transcribe.title")}
          </h2>
          <p className="mt-2 text-sm text-muted">{t("ai.transcribe.help")}</p>
          {current.classrooms.length ? (
            <div className="mt-6 grid gap-8 lg:grid-cols-2">
              <form className="grid gap-3" onSubmit={onTranscribe}>
                <label className="grid gap-1 text-sm font-semibold text-muted">
                  {t("ai.lesson")}
                  <select name="classroomId" className={fieldClass} required>
                    {current.classrooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold text-muted">
                  {t("ai.locale")}
                  <select name="locale" className={fieldClass} defaultValue="en">
                    {AI_LOCALES.map((item) => (
                      <option key={item} value={item}>
                        {t(item === "ar" ? "ai.locale.ar" : "ai.locale.en")}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" disabled={pending}>
                  {t("ai.transcribe.submit")}
                </Button>
              </form>
              <form className="grid gap-3" onSubmit={onSaveText}>
                <label className="grid gap-1 text-sm font-semibold text-muted">
                  {t("ai.lesson")}
                  <select name="classroomId" className={fieldClass} required>
                    {current.classrooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold text-muted">
                  {t("ai.locale")}
                  <select name="locale" className={fieldClass} defaultValue="en">
                    {AI_LOCALES.map((item) => (
                      <option key={item} value={item}>
                        {t(item === "ar" ? "ai.locale.ar" : "ai.locale.en")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold text-muted">
                  {t("ai.typed")}
                  <textarea
                    name="body"
                    rows={5}
                    required
                    className={`${fieldClass} min-h-28 py-3`}
                  />
                </label>
                <Button type="submit" disabled={pending} variant="secondary">
                  {t("ai.typed.submit")}
                </Button>
              </form>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">{t("ai.none.lessons")}</p>
          )}
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
            {t("ai.transcripts")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["en", "ai.locale.en"],
                ["ar", "ai.locale.ar"],
                ["all", "ai.locale.all"],
              ] as const
            ).map(([value, key]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={language === value ? "primary" : "secondary"}
                onClick={() => setLanguage(value)}
              >
                {t(key)}
              </Button>
            ))}
          </div>
        </div>
        {shown.length ? (
          shown.map((item) => (
            <TranscriptCard
              key={item.id}
              item={item}
              query={current.query}
              open={openId === item.id}
              canEdit={current.canEdit}
              pending={pending}
              onOpen={() => setOpenId(item.id === openId ? null : item.id)}
              onReview={(decision) =>
                run({ action: "review", jobId: item.jobId, decision })
              }
              onRelabel={(segmentIndex, speakerRole, speakerName) =>
                run({
                  action: "relabel",
                  jobId: item.jobId,
                  segmentIndex,
                  speakerRole,
                  speakerName,
                })
              }
              onSummarise={() => run({ action: "summarise", transcriptJobId: item.jobId })}
              canWriteNotes={current.canWriteNotes}
              onWriteNotes={() => run({ action: "save_notes", transcriptJobId: item.jobId })}
              onWriteHomework={() =>
                run({ action: "generate_homework", transcriptJobId: item.jobId })
              }
              onWriteQuiz={() =>
                run({ action: "generate_quiz_lesson", transcriptJobId: item.jobId })
              }
              onWriteRecommendation={() =>
                run({ action: "generate_recommendation", transcriptJobId: item.jobId })
              }
            />
          ))
        ) : (
          <p className="rounded-[2rem] border border-line bg-surface px-5 py-4 text-sm text-muted">
            {t(
              current.query
                ? "ai.search.none"
                : language === "all"
                  ? "ai.none.transcripts"
                  : "ai.none.language",
            )}
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
          {t("ai.summary.title")}
        </h2>
        {shownSummaries.length ? (
          shownSummaries.map((item) => (
            <SummaryCard
              key={item.id}
              item={item}
              query={current.query}
              open={openId === item.id}
              canEdit={current.canEdit}
              pending={pending}
              onOpen={() => setOpenId(item.id === openId ? null : item.id)}
              onReview={(decision) =>
                run({ action: "review", jobId: item.id, decision })
              }
              onSavePoints={(keyPoints) =>
                run({ action: "save_key_points", jobId: item.id, keyPoints })
              }
              onSaveVocabulary={(vocabulary) =>
                run({ action: "save_vocabulary", jobId: item.id, vocabulary })
              }
              onSaveImprovements={(improvementAreas) =>
                run({
                  action: "save_improvement_areas",
                  jobId: item.id,
                  improvementAreas,
                })
              }
              onSaveNext={(nextLessonRecommendations) =>
                run({
                  action: "save_next_recommendations",
                  jobId: item.id,
                  nextLessonRecommendations,
                })
              }
            />
          ))
        ) : (
          <p className="rounded-[2rem] border border-line bg-surface px-5 py-4 text-sm text-muted">
            {t(
              current.query
                ? "ai.summary.none_search"
                : language === "all"
                  ? "ai.summary.none"
                  : "ai.summary.none_language",
            )}
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
          {t("ai.notes.title")}
        </h2>
        {shownNotes.length ? (
          shownNotes.map((item) => (
            <NoteCard
              key={item.id}
              item={item}
              query={current.query}
              open={openId === item.id}
              canWrite={current.canWriteNotes}
              pending={pending}
              onOpen={() => setOpenId(item.id === openId ? null : item.id)}
              onSave={(body) => run({ action: "update_notes", jobId: item.id, body })}
            />
          ))
        ) : (
          <p className="rounded-[2rem] border border-line bg-surface px-5 py-4 text-sm text-muted">
            {t(
              current.query
                ? "ai.notes.none_search"
                : current.canWriteNotes
                  ? "ai.notes.none"
                  : "ai.notes.private",
            )}
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
          {t("ai.homework.title")}
        </h2>
        {shownHomework.length ? (
          shownHomework.map((item) => (
            <HomeworkCard
              key={item.id}
              item={item}
              query={current.query}
              open={openId === item.id}
              canEdit={current.canEdit}
              pending={pending}
              onOpen={() => setOpenId(item.id === openId ? null : item.id)}
              onReview={(decision) =>
                run({ action: "review", jobId: item.id, decision })
              }
              onSave={(draft) =>
                run({
                  action: "update_homework",
                  jobId: item.id,
                  title: draft.title,
                  body: draft.body,
                  tasks: draft.tasks,
                })
              }
            />
          ))
        ) : (
          <p className="rounded-[2rem] border border-line bg-surface px-5 py-4 text-sm text-muted">
            {t(
              current.query
                ? "ai.homework.none_search"
                : language === "all"
                  ? "ai.homework.none"
                  : "ai.homework.none_language",
            )}
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
          {t("ai.quiz.title")}
        </h2>
        {shownQuizzes.length ? (
          shownQuizzes.map((item) => (
            <QuizCard
              key={item.id}
              item={item}
              query={current.query}
              open={openId === item.id}
              canEdit={current.canEdit}
              pending={pending}
              onOpen={() => setOpenId(item.id === openId ? null : item.id)}
              onReview={(decision) =>
                run({ action: "review", jobId: item.id, decision })
              }
              onSave={(draft) =>
                run({
                  action: "update_quiz",
                  jobId: item.id,
                  title: draft.title,
                  body: draft.body,
                  questions: draft.questions,
                })
              }
            />
          ))
        ) : (
          <p className="rounded-[2rem] border border-line bg-surface px-5 py-4 text-sm text-muted">
            {t(
              current.query
                ? "ai.quiz.none_search"
                : language === "all"
                  ? "ai.quiz.none"
                  : "ai.quiz.none_language",
            )}
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
          {t("ai.recommend.title")}
        </h2>
        {shownRecommendations.length ? (
          shownRecommendations.map((item) => (
            <RecommendationCard
              key={item.id}
              item={item}
              query={current.query}
              open={openId === item.id}
              canEdit={current.canEdit}
              pending={pending}
              onOpen={() => setOpenId(item.id === openId ? null : item.id)}
              onReview={(decision) =>
                run({ action: "review", jobId: item.id, decision })
              }
              onSave={(draft) =>
                run({
                  action: "update_recommendation",
                  jobId: item.id,
                  title: draft.title,
                  body: draft.body,
                  items: draft.items,
                })
              }
            />
          ))
        ) : (
          <p className="rounded-[2rem] border border-line bg-surface px-5 py-4 text-sm text-muted">
            {t(
              current.query
                ? "ai.recommend.none_search"
                : language === "all"
                  ? "ai.recommend.none"
                  : "ai.recommend.none_language",
            )}
          </p>
        )}
      </section>
    </div>
  );
}

function HighlightedText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  const parts = highlightTranscriptParts(text, query);
  return (
    <>
      {parts.map((part, index) =>
        part.match ? (
          <mark key={`${part.text}-${index}`} className="rounded-sm bg-[#F3E6D0] text-brand">
            {part.text}
          </mark>
        ) : (
          <span key={`${part.text}-${index}`}>{part.text}</span>
        ),
      )}
    </>
  );
}

function KeyPointsForm({
  points,
  pending,
  onSave,
}: {
  points: string[];
  pending: boolean;
  onSave: (keyPoints: string) => void;
}) {
  const t = useT();
  const [value, setValue] = useState(points.join("\n"));
  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(value);
      }}
    >
      <label className="grid gap-1 text-sm font-semibold text-muted">
        {t("ai.points.label")}
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={4}
          required
          minLength={8}
          className={`${fieldClass} min-h-24 py-3`}
          placeholder={t("ai.points.placeholder")}
        />
      </label>
      <Button type="submit" size="sm" disabled={pending || value.trim().length < 8}>
        {t("ai.points.save")}
      </Button>
    </form>
  );
}

function VocabularyForm({
  words,
  pending,
  onSave,
}: {
  words: string[];
  pending: boolean;
  onSave: (vocabulary: string) => void;
}) {
  const t = useT();
  const [value, setValue] = useState(words.join("\n"));
  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(value);
      }}
    >
      <label className="grid gap-1 text-sm font-semibold text-muted">
        {t("ai.vocab.label")}
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={4}
          required
          minLength={2}
          className={`${fieldClass} min-h-24 py-3`}
          placeholder={t("ai.vocab.placeholder")}
        />
      </label>
      <Button type="submit" size="sm" disabled={pending || value.trim().length < 2}>
        {t("ai.vocab.save")}
      </Button>
    </form>
  );
}

function ImprovementAreasForm({
  areas,
  pending,
  onSave,
}: {
  areas: string[];
  pending: boolean;
  onSave: (improvementAreas: string) => void;
}) {
  const t = useT();
  const [value, setValue] = useState(areas.join("\n"));
  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(value);
      }}
    >
      <label className="grid gap-1 text-sm font-semibold text-muted">
        {t("ai.improve.label")}
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={4}
          required
          minLength={8}
          className={`${fieldClass} min-h-24 py-3`}
          placeholder={t("ai.improve.placeholder")}
        />
      </label>
      <Button type="submit" size="sm" disabled={pending || value.trim().length < 8}>
        {t("ai.improve.save")}
      </Button>
    </form>
  );
}

function ReviewQueueCard({
  item,
  pending,
  onReview,
}: {
  item: AiReviewItem;
  pending: boolean;
  onReview: (decision: "approve" | "reject", note?: string) => void;
}) {
  const t = useT();
  const [note, setNote] = useState("");
  return (
    <article className="rounded-2xl border border-line bg-background p-4">
      <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
        {t("ai.review.queue")}
        {` · ${t(kindKeys[item.kind])}`}
        {` · ${t(statusKeys[item.status])}`}
        <AiOriginMark origin={item.origin} />
      </p>
      <h3 className="font-heading mt-2 text-lg font-bold tracking-tight text-brand">
        {item.title}
      </h3>
      <p className="mt-1 text-sm text-muted">
        {item.classroomTitle}
        {` · ${t(item.locale === "ar" ? "ai.locale.ar" : "ai.locale.en")}`}
      </p>
      {item.excerpt ? (
        <p className="mt-2 text-sm text-brand" dir={item.locale === "ar" ? "rtl" : "ltr"}>
          {item.excerpt}
        </p>
      ) : null}
      <p className="mt-2 text-sm font-semibold text-[#CB9F64]">
        {t("ai.review.unpublished")}
      </p>
      <label className="mt-3 grid gap-1 text-sm font-semibold text-muted">
        {t("ai.review.note")}
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          maxLength={400}
          className={`${fieldClass} min-h-20 py-3`}
          placeholder={t("ai.review.note.placeholder")}
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-3">
        <Button
          type="button"
          disabled={pending}
          onClick={() => onReview("approve", note.trim() || undefined)}
        >
          {t("ai.approve")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => onReview("reject", note.trim() || undefined)}
        >
          {t("ai.reject")}
        </Button>
      </div>
    </article>
  );
}

function NextLessonForm({
  items,
  pending,
  onSave,
}: {
  items: string[];
  pending: boolean;
  onSave: (nextLessonRecommendations: string) => void;
}) {
  const t = useT();
  const [value, setValue] = useState(items.join("\n"));
  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(value);
      }}
    >
      <label className="grid gap-1 text-sm font-semibold text-muted">
        {t("ai.next.label")}
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={4}
          required
          minLength={8}
          className={`${fieldClass} min-h-24 py-3`}
          placeholder={t("ai.next.placeholder")}
        />
      </label>
      <Button type="submit" size="sm" disabled={pending || value.trim().length < 8}>
        {t("ai.next.save")}
      </Button>
    </form>
  );
}

function SummaryCard({
  item,
  query,
  open,
  canEdit,
  pending,
  onOpen,
  onReview,
  onSavePoints,
  onSaveVocabulary,
  onSaveImprovements,
  onSaveNext,
}: {
  item: AiSummaryView;
  query: string;
  open: boolean;
  canEdit: boolean;
  pending: boolean;
  onOpen: () => void;
  onReview: (decision: "approve" | "reject") => void;
  onSavePoints: (keyPoints: string) => void;
  onSaveVocabulary: (vocabulary: string) => void;
  onSaveImprovements: (improvementAreas: string) => void;
  onSaveNext: (nextLessonRecommendations: string) => void;
}) {
  const t = useT();
  const canReview =
    canEdit && (item.status === "needs_review" || item.status === "processing");
  return (
    <article className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <button type="button" className="w-full text-left" onClick={onOpen}>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
          {t(statusKeys[item.status])}
          <AiOriginMark origin={item.origin} />
          {reviewPublishKey(item.status, item.publishedAt)
            ? ` · ${t(reviewPublishKey(item.status, item.publishedAt)!)}`
            : ""}
        </p>
        <h3 className="font-heading mt-2 text-xl font-bold tracking-tight text-brand">
          <HighlightedText text={item.classroomTitle} query={query} />
        </h3>
        <p className="mt-2 text-sm text-muted">
          {t(item.locale === "ar" ? "ai.locale.ar" : "ai.locale.en")}
          {item.keyPoints.length
            ? ` · ${t("ai.points.count", { n: item.keyPoints.length })}`
            : ""}
          {item.vocabulary.length
            ? ` · ${t("ai.vocab.count", { n: item.vocabulary.length })}`
            : ""}
          {item.improvementAreas.length
            ? ` · ${t("ai.improve.count", { n: item.improvementAreas.length })}`
            : ""}
          {item.nextLessonRecommendations.length
            ? ` · ${t("ai.next.count", { n: item.nextLessonRecommendations.length })}`
            : ""}
        </p>
      </button>
      {open ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-brand" dir={item.locale === "ar" ? "rtl" : "ltr"}>
            <HighlightedText text={item.body} query={query} />
          </p>
          <div>
            <p className="text-sm font-semibold text-brand">{t("ai.points.title")}</p>
            {item.keyPoints.length ? (
              <ul className="mt-2 grid gap-2" dir={item.locale === "ar" ? "rtl" : "ltr"}>
                {item.keyPoints.map((point, index) => (
                  <li
                    key={`${item.id}-point-${index}`}
                    className="rounded-2xl bg-background px-4 py-3 text-sm text-brand"
                  >
                    <HighlightedText text={point} query={query} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">{t("ai.points.none")}</p>
            )}
          </div>
          {canReview ? (
            <KeyPointsForm
              key={`${item.id}-${item.keyPoints.join("|")}`}
              points={item.keyPoints}
              pending={pending}
              onSave={onSavePoints}
            />
          ) : null}
          <div>
            <p className="text-sm font-semibold text-brand">{t("ai.vocab.title")}</p>
            {item.vocabulary.length ? (
              <ul
                className="mt-2 flex flex-wrap gap-2"
                dir={item.locale === "ar" ? "rtl" : "ltr"}
              >
                {item.vocabulary.map((word, index) => (
                  <li
                    key={`${item.id}-vocab-${index}`}
                    className="rounded-full bg-background px-3 py-1.5 text-sm text-brand"
                  >
                    <HighlightedText text={word} query={query} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">{t("ai.vocab.none")}</p>
            )}
          </div>
          {canReview ? (
            <VocabularyForm
              key={`${item.id}-vocab-${item.vocabulary.join("|")}`}
              words={item.vocabulary}
              pending={pending}
              onSave={onSaveVocabulary}
            />
          ) : null}
          <div>
            <p className="text-sm font-semibold text-brand">{t("ai.improve.title")}</p>
            {item.improvementAreas.length ? (
              <ul className="mt-2 grid gap-2" dir={item.locale === "ar" ? "rtl" : "ltr"}>
                {item.improvementAreas.map((area, index) => (
                  <li
                    key={`${item.id}-improve-${index}`}
                    className="rounded-2xl bg-background px-4 py-3 text-sm text-brand"
                  >
                    <HighlightedText text={area} query={query} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">{t("ai.improve.none")}</p>
            )}
          </div>
          {canReview ? (
            <ImprovementAreasForm
              key={`${item.id}-improve-${item.improvementAreas.join("|")}`}
              areas={item.improvementAreas}
              pending={pending}
              onSave={onSaveImprovements}
            />
          ) : null}
          <div>
            <p className="text-sm font-semibold text-brand">{t("ai.next.title")}</p>
            {item.nextLessonRecommendations.length ? (
              <ul className="mt-2 grid gap-2" dir={item.locale === "ar" ? "rtl" : "ltr"}>
                {item.nextLessonRecommendations.map((line, index) => (
                  <li
                    key={`${item.id}-next-${index}`}
                    className="rounded-2xl bg-background px-4 py-3 text-sm text-brand"
                  >
                    <HighlightedText text={line} query={query} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">{t("ai.next.none")}</p>
            )}
          </div>
          {canReview ? (
            <NextLessonForm
              key={`${item.id}-next-${item.nextLessonRecommendations.join("|")}`}
              items={item.nextLessonRecommendations}
              pending={pending}
              onSave={onSaveNext}
            />
          ) : null}
          {canReview ? (
            <div className="flex flex-wrap gap-3">
              <Button type="button" disabled={pending} onClick={() => onReview("approve")}>
                {t("ai.approve")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => onReview("reject")}
              >
                {t("ai.reject")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 line-clamp-3 text-sm text-muted" dir={item.locale === "ar" ? "rtl" : "ltr"}>
          <HighlightedText text={item.body} query={query} />
        </p>
      )}
    </article>
  );
}

function NotesForm({
  body,
  pending,
  onSave,
}: {
  body: string;
  pending: boolean;
  onSave: (body: string) => void;
}) {
  const t = useT();
  const [value, setValue] = useState(body);
  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(value);
      }}
    >
      <label className="grid gap-1 text-sm font-semibold text-muted">
        {t("ai.notes.typed")}
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={5}
          required
          minLength={8}
          className={`${fieldClass} min-h-28 py-3`}
          placeholder={t("ai.notes.placeholder")}
        />
      </label>
      <Button type="submit" size="sm" disabled={pending || value.trim().length < 8}>
        {t("ai.notes.save")}
      </Button>
    </form>
  );
}

function NoteCard({
  item,
  query,
  open,
  canWrite,
  pending,
  onOpen,
  onSave,
}: {
  item: AiNoteView;
  query: string;
  open: boolean;
  canWrite: boolean;
  pending: boolean;
  onOpen: () => void;
  onSave: (body: string) => void;
}) {
  const t = useT();
  return (
    <article className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <button type="button" className="w-full text-left" onClick={onOpen}>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
          {t("ai.notes.private_label")}
          <AiOriginMark origin={item.origin} />
        </p>
        <h3 className="font-heading mt-2 text-xl font-bold tracking-tight text-brand">
          <HighlightedText text={item.classroomTitle} query={query} />
        </h3>
        <p className="mt-2 text-sm text-muted">
          {t(item.locale === "ar" ? "ai.locale.ar" : "ai.locale.en")}
          {item.bullets.length ? ` · ${t("ai.notes.count", { n: item.bullets.length })}` : ""}
        </p>
      </button>
      {open ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-brand" dir={item.locale === "ar" ? "rtl" : "ltr"}>
            <HighlightedText text={item.body} query={query} />
          </p>
          {item.bullets.length ? (
            <ul className="grid gap-2" dir={item.locale === "ar" ? "rtl" : "ltr"}>
              {item.bullets.map((bullet, index) => (
                <li
                  key={`${item.id}-note-${index}`}
                  className="rounded-2xl bg-background px-4 py-3 text-sm text-brand"
                >
                  <HighlightedText text={bullet} query={query} />
                </li>
              ))}
            </ul>
          ) : null}
          {canWrite ? (
            <NotesForm
              key={`${item.id}-${item.body}`}
              body={item.body}
              pending={pending}
              onSave={onSave}
            />
          ) : null}
        </div>
      ) : (
        <p className="mt-3 line-clamp-3 text-sm text-muted" dir={item.locale === "ar" ? "rtl" : "ltr"}>
          <HighlightedText text={item.body} query={query} />
        </p>
      )}
    </article>
  );
}

function HomeworkForm({
  title,
  body,
  tasks,
  pending,
  onSave,
}: {
  title: string;
  body: string;
  tasks: string[];
  pending: boolean;
  onSave: (draft: { title: string; body: string; tasks: string }) => void;
}) {
  const t = useT();
  const [name, setName] = useState(title);
  const [value, setValue] = useState(body);
  const [taskText, setTaskText] = useState(tasks.join("\n"));
  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ title: name, body: value, tasks: taskText });
      }}
    >
      <label className="grid gap-1 text-sm font-semibold text-muted">
        {t("ai.homework.name")}
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          minLength={2}
          className={fieldClass}
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-muted">
        {t("ai.homework.typed")}
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={5}
          required
          minLength={20}
          className={`${fieldClass} min-h-28 py-3`}
          placeholder={t("ai.homework.placeholder")}
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-muted">
        {t("ai.homework.tasks")}
        <textarea
          value={taskText}
          onChange={(event) => setTaskText(event.target.value)}
          rows={4}
          className={`${fieldClass} min-h-24 py-3`}
          placeholder={t("ai.homework.tasks.placeholder")}
        />
      </label>
      <Button type="submit" size="sm" disabled={pending || name.trim().length < 2 || value.trim().length < 20}>
        {t("ai.homework.save")}
      </Button>
    </form>
  );
}

function HomeworkCard({
  item,
  query,
  open,
  canEdit,
  pending,
  onOpen,
  onReview,
  onSave,
}: {
  item: AiHomeworkView;
  query: string;
  open: boolean;
  canEdit: boolean;
  pending: boolean;
  onOpen: () => void;
  onReview: (decision: "approve" | "reject") => void;
  onSave: (draft: { title: string; body: string; tasks: string }) => void;
}) {
  const t = useT();
  const canReview =
    canEdit && (item.status === "needs_review" || item.status === "processing");
  return (
    <article className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <button type="button" className="w-full text-left" onClick={onOpen}>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
          {t(statusKeys[item.status])}
          <AiOriginMark origin={item.origin} />
          {reviewPublishKey(item.status, item.publishedAt)
            ? ` · ${t(reviewPublishKey(item.status, item.publishedAt)!)}`
            : ""}
        </p>
        <h3 className="font-heading mt-2 text-xl font-bold tracking-tight text-brand">
          <HighlightedText text={item.title || item.classroomTitle} query={query} />
        </h3>
        <p className="mt-2 text-sm text-muted">
          {t(item.locale === "ar" ? "ai.locale.ar" : "ai.locale.en")}
          {` · ${item.classroomTitle}`}
          {item.tasks.length ? ` · ${t("ai.homework.count", { n: item.tasks.length })}` : ""}
        </p>
      </button>
      {open ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-brand" dir={item.locale === "ar" ? "rtl" : "ltr"}>
            <HighlightedText text={item.body} query={query} />
          </p>
          {item.tasks.length ? (
            <ul className="grid gap-2" dir={item.locale === "ar" ? "rtl" : "ltr"}>
              {item.tasks.map((task, index) => (
                <li
                  key={`${item.id}-task-${index}`}
                  className="rounded-2xl bg-background px-4 py-3 text-sm text-brand"
                >
                  <HighlightedText text={task} query={query} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t("ai.homework.none_tasks")}</p>
          )}
          {canReview ? (
            <HomeworkForm
              key={`${item.id}-${item.title}-${item.body}`}
              title={item.title}
              body={item.body}
              tasks={item.tasks}
              pending={pending}
              onSave={onSave}
            />
          ) : null}
          {canReview ? (
            <div className="flex flex-wrap gap-3">
              <Button type="button" disabled={pending} onClick={() => onReview("approve")}>
                {t("ai.approve")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => onReview("reject")}
              >
                {t("ai.reject")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 line-clamp-3 text-sm text-muted" dir={item.locale === "ar" ? "rtl" : "ltr"}>
          <HighlightedText text={item.body} query={query} />
        </p>
      )}
    </article>
  );
}

function QuizForm({
  title,
  body,
  questions,
  pending,
  onSave,
}: {
  title: string;
  body: string;
  questions: string[];
  pending: boolean;
  onSave: (draft: { title: string; body: string; questions: string }) => void;
}) {
  const t = useT();
  const [name, setName] = useState(title);
  const [value, setValue] = useState(body);
  const [questionText, setQuestionText] = useState(questions.join("\n"));
  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ title: name, body: value, questions: questionText });
      }}
    >
      <label className="grid gap-1 text-sm font-semibold text-muted">
        {t("ai.quiz.name")}
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          minLength={2}
          className={fieldClass}
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-muted">
        {t("ai.quiz.instructions")}
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={4}
          required
          minLength={20}
          className={`${fieldClass} min-h-24 py-3`}
          placeholder={t("ai.quiz.placeholder")}
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-muted">
        {t("ai.quiz.questions")}
        <textarea
          value={questionText}
          onChange={(event) => setQuestionText(event.target.value)}
          rows={4}
          className={`${fieldClass} min-h-24 py-3`}
          placeholder={t("ai.quiz.questions.placeholder")}
        />
      </label>
      <Button
        type="submit"
        size="sm"
        disabled={pending || name.trim().length < 2 || value.trim().length < 20}
      >
        {t("ai.quiz.save")}
      </Button>
    </form>
  );
}

function RecommendationForm({
  title,
  body,
  items,
  pending,
  onSave,
}: {
  title: string;
  body: string;
  items: string[];
  pending: boolean;
  onSave: (draft: { title: string; body: string; items: string }) => void;
}) {
  const t = useT();
  const [name, setName] = useState(title);
  const [value, setValue] = useState(body);
  const [itemText, setItemText] = useState(items.join("\n"));
  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ title: name, body: value, items: itemText });
      }}
    >
      <label className="grid gap-1 text-sm font-semibold text-muted">
        {t("ai.recommend.name")}
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          minLength={2}
          className={fieldClass}
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-muted">
        {t("ai.recommend.instructions")}
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          required
          minLength={20}
          rows={4}
          className={`${fieldClass} min-h-24 py-3`}
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-muted">
        {t("ai.recommend.items")}
        <textarea
          value={itemText}
          onChange={(event) => setItemText(event.target.value)}
          required
          rows={4}
          className={`${fieldClass} min-h-24 py-3`}
        />
      </label>
      <Button
        type="submit"
        size="sm"
        disabled={pending || name.trim().length < 2 || value.trim().length < 20}
      >
        {t("ai.recommend.save")}
      </Button>
    </form>
  );
}

function RecommendationCard({
  item,
  query,
  open,
  canEdit,
  pending,
  onOpen,
  onReview,
  onSave,
}: {
  item: AiRecommendationView;
  query: string;
  open: boolean;
  canEdit: boolean;
  pending: boolean;
  onOpen: () => void;
  onReview: (decision: "approve" | "reject") => void;
  onSave: (draft: { title: string; body: string; items: string }) => void;
}) {
  const t = useT();
  const canReview =
    canEdit && (item.status === "needs_review" || item.status === "processing");
  return (
    <article className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <button type="button" className="w-full text-left" onClick={onOpen}>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
          {t(statusKeys[item.status])}
          <AiOriginMark origin={item.origin} />
          {reviewPublishKey(item.status, item.publishedAt)
            ? ` · ${t(reviewPublishKey(item.status, item.publishedAt)!)}`
            : ""}
        </p>
        <h3 className="font-heading mt-2 text-xl font-bold tracking-tight text-brand">
          <HighlightedText text={item.title || item.classroomTitle} query={query} />
        </h3>
        <p className="mt-2 text-sm text-muted">
          {t(item.locale === "ar" ? "ai.locale.ar" : "ai.locale.en")}
          {` · ${item.classroomTitle}`}
          {item.sourceLabel && item.sourceLabel !== item.classroomTitle
            ? ` · ${item.sourceLabel}`
            : ""}
          {item.items.length ? ` · ${t("ai.recommend.count", { n: item.items.length })}` : ""}
        </p>
      </button>
      {open ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-brand" dir={item.locale === "ar" ? "rtl" : "ltr"}>
            <HighlightedText text={item.body} query={query} />
          </p>
          {item.items.length ? (
            <ul className="grid gap-2" dir={item.locale === "ar" ? "rtl" : "ltr"}>
              {item.items.map((line, index) => (
                <li
                  key={`${item.id}-item-${index}`}
                  className="rounded-2xl bg-background px-4 py-3 text-sm text-brand"
                >
                  <HighlightedText text={line} query={query} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t("ai.recommend.none_items")}</p>
          )}
          {item.focus.length ? (
            <div dir={item.locale === "ar" ? "rtl" : "ltr"}>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#CB9F64]">
                {t("ai.recommend.focus")}
              </p>
              <ul className="mt-2 grid gap-2">
                {item.focus.map((line, index) => (
                  <li
                    key={`${item.id}-focus-${index}`}
                    className="rounded-2xl bg-background px-4 py-3 text-sm text-muted"
                  >
                    <HighlightedText text={line} query={query} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {canReview ? (
            <RecommendationForm
              key={`${item.id}-${item.title}-${item.body}`}
              title={item.title}
              body={item.body}
              items={item.items}
              pending={pending}
              onSave={onSave}
            />
          ) : null}
          {canReview ? (
            <div className="flex flex-wrap gap-3">
              <Button type="button" disabled={pending} onClick={() => onReview("approve")}>
                {t("ai.approve")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => onReview("reject")}
              >
                {t("ai.reject")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 line-clamp-3 text-sm text-muted" dir={item.locale === "ar" ? "rtl" : "ltr"}>
          <HighlightedText text={item.body} query={query} />
        </p>
      )}
    </article>
  );
}

function QuizCard({
  item,
  query,
  open,
  canEdit,
  pending,
  onOpen,
  onReview,
  onSave,
}: {
  item: AiQuizView;
  query: string;
  open: boolean;
  canEdit: boolean;
  pending: boolean;
  onOpen: () => void;
  onReview: (decision: "approve" | "reject") => void;
  onSave: (draft: { title: string; body: string; questions: string }) => void;
}) {
  const t = useT();
  const canReview =
    canEdit && (item.status === "needs_review" || item.status === "processing");
  const sourceKey =
    item.source === "book"
      ? "ai.quiz.source.book"
      : item.source === "topic"
        ? "ai.quiz.source.topic"
        : item.source === "upload"
          ? "ai.quiz.source.upload"
          : item.source === "previous"
            ? "ai.quiz.source.previous"
            : "ai.quiz.source.lesson";
  return (
    <article className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <button type="button" className="w-full text-left" onClick={onOpen}>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
          {t(statusKeys[item.status])}
          <AiOriginMark origin={item.origin} />
          {` · ${t(sourceKey)}`}
          {reviewPublishKey(item.status, item.publishedAt)
            ? ` · ${t(reviewPublishKey(item.status, item.publishedAt)!)}`
            : ""}
        </p>
        <h3 className="font-heading mt-2 text-xl font-bold tracking-tight text-brand">
          <HighlightedText text={item.title || item.classroomTitle} query={query} />
        </h3>
        <p className="mt-2 text-sm text-muted">
          {t(item.locale === "ar" ? "ai.locale.ar" : "ai.locale.en")}
          {` · ${item.classroomTitle}`}
          {(item.source === "upload" || item.source === "previous") && item.sourceLabel
            ? ` · ${item.sourceLabel}`
            : ""}
          {item.questions.length ? ` · ${t("ai.quiz.count", { n: item.questions.length })}` : ""}
        </p>
      </button>
      {open ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-brand" dir={item.locale === "ar" ? "rtl" : "ltr"}>
            <HighlightedText text={item.body} query={query} />
          </p>
          {item.questions.length ? (
            <ol className="grid gap-2" dir={item.locale === "ar" ? "rtl" : "ltr"}>
              {item.questions.map((question, index) => (
                <li
                  key={`${item.id}-q-${index}`}
                  className="rounded-2xl bg-background px-4 py-3 text-sm text-brand"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#CB9F64]">
                    {t(
                      question.kind === "choice"
                        ? "quiz.kind.choice"
                        : question.kind === "true_false"
                          ? "quiz.kind.true_false"
                          : question.kind === "short"
                            ? "quiz.kind.short"
                            : "quiz.kind.written",
                    )}
                  </p>
                  <p className="mt-1">
                    <HighlightedText text={question.prompt} query={query} />
                  </p>
                  {question.kind === "choice" && question.choices?.length ? (
                    <ul className="mt-2 grid gap-1">
                      {question.choices.map((choice, choiceIndex) => (
                        <li key={`${item.id}-c-${index}-${choiceIndex}`}>
                          {choice}
                          {question.choiceAnswer === choiceIndex
                            ? ` · ${t("ai.quiz.answer")}`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {question.kind === "short" && question.accepted?.length ? (
                    <p className="mt-2 text-xs font-semibold text-muted">
                      {t("ai.quiz.accepted", { list: question.accepted.join(", ") })}
                    </p>
                  ) : null}
                  {question.kind === "true_false" && question.answer !== undefined ? (
                    <p className="mt-2 text-xs font-semibold text-muted">
                      {t(question.answer ? "quiz.true" : "quiz.false")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">{t("ai.quiz.none_questions")}</p>
          )}
          {canReview ? (
            <QuizForm
              key={`${item.id}-${item.title}-${item.body}`}
              title={item.title}
              body={item.body}
              questions={item.questions.map((question) => question.prompt)}
              pending={pending}
              onSave={onSave}
            />
          ) : null}
          {canReview ? (
            <div className="flex flex-wrap gap-3">
              <Button type="button" disabled={pending} onClick={() => onReview("approve")}>
                {t("ai.approve")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => onReview("reject")}
              >
                {t("ai.reject")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 line-clamp-3 text-sm text-muted" dir={item.locale === "ar" ? "rtl" : "ltr"}>
          <HighlightedText text={item.body} query={query} />
        </p>
      )}
    </article>
  );
}

function TranscriptCard({
  item,
  query,
  open,
  canEdit,
  pending,
  onOpen,
  onReview,
  onRelabel,
  onSummarise,
  canWriteNotes,
  onWriteNotes,
  onWriteHomework,
  onWriteQuiz,
  onWriteRecommendation,
}: {
  item: AiTranscriptView;
  query: string;
  open: boolean;
  canEdit: boolean;
  pending: boolean;
  onOpen: () => void;
  onReview: (decision: "approve" | "reject") => void;
  onRelabel: (segmentIndex: number, speakerRole: AiSpeakerRole, speakerName: string) => void;
  onSummarise: () => void;
  canWriteNotes: boolean;
  onWriteNotes: () => void;
  onWriteHomework: () => void;
  onWriteQuiz: () => void;
  onWriteRecommendation: () => void;
}) {
  const t = useT();
  const [speakerFilter, setSpeakerFilter] = useState("all");
  const lines = item.segments
    .map((segment, index) => ({ segment, index }))
    .filter(
      (line) => speakerFilter === "all" || speakerKey(line.segment) === speakerFilter,
    );
  const canRelabel =
    canEdit && (item.status === "needs_review" || item.status === "processing");
  return (
    <article className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <button type="button" className="w-full text-left" onClick={onOpen}>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
          {t(statusKeys[item.status])}
          {` · ${t(sourceKeys[item.source])}`}
          <AiOriginMark origin={item.origin} />
          {query && item.matchCount > 0 ? ` · ${t("ai.search.hits", { n: item.matchCount })}` : ""}
          {reviewPublishKey(item.status, item.publishedAt)
            ? ` · ${t(reviewPublishKey(item.status, item.publishedAt)!)}`
            : ""}
        </p>
        <h3 className="font-heading mt-2 text-xl font-bold tracking-tight text-brand">
          <HighlightedText text={item.classroomTitle} query={query} />
        </h3>
        <p className="mt-2 text-sm text-muted">
          {t(item.locale === "ar" ? "ai.locale.ar" : "ai.locale.en")}
          {" · "}
          {t("ai.speakers", { n: item.speakerCount })}
          {item.identifiedSpeakerCount
            ? ` · ${t("ai.speakers.identified", { n: item.identifiedSpeakerCount })}`
            : ""}
        </p>
      </button>
      {item.speakers.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={speakerFilter === "all" ? "primary" : "secondary"}
            onClick={() => setSpeakerFilter("all")}
          >
            {t("ai.speakers.all")}
          </Button>
          {item.speakers.map((speaker) => (
            <Button
              key={speaker.key}
              type="button"
              size="sm"
              variant={speakerFilter === speaker.key ? "primary" : "secondary"}
              onClick={() => setSpeakerFilter(speaker.key)}
            >
              {speaker.name}
              {` · ${t(speakerKeys[speaker.role])}`}
            </Button>
          ))}
        </div>
      ) : null}
      {open ? (
        <div className="mt-4 space-y-3">
          {item.segments.length > 0 && item.identifiedSpeakerCount === 0 ? (
            <p className="text-sm text-muted">{t("ai.speakers.unknown")}</p>
          ) : null}
          {lines.length ? (
            <ol className="grid gap-2">
              {lines.map(({ segment, index }) => (
                <li
                  key={`${item.id}-${index}`}
                  className={`rounded-2xl px-4 py-3 ${speakerToneClass(segment.speakerRole)} ${
                    query && item.matchedIndexes.includes(index)
                      ? "bg-[#F3E6D0]"
                      : "bg-background"
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#CB9F64]">
                    <HighlightedText text={segment.speakerName} query={query} />
                    {" · "}
                    {t(speakerKeys[segment.speakerRole])}
                  </p>
                  <p className="mt-1 text-sm text-brand" dir={item.locale === "ar" ? "rtl" : "ltr"}>
                    <HighlightedText text={segment.body} query={query} />
                  </p>
                  {canRelabel ? (
                    <SpeakerRelabelForm
                      key={`${item.id}-${index}-${segment.speakerName}-${segment.speakerRole}`}
                      name={segment.speakerName}
                      role={segment.speakerRole}
                      pending={pending}
                      onApply={(speakerRole, speakerName) =>
                        onRelabel(index, speakerRole, speakerName)
                      }
                    />
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">
              {t(item.segments.length ? "ai.speakers.none" : "ai.none.segments")}
            </p>
          )}
          {canEdit || canWriteNotes ? (
            <div className="flex flex-wrap gap-3">
              {canEdit ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={onSummarise}
                >
                  {t("ai.summary.from_transcript")}
                </Button>
              ) : null}
              {canWriteNotes ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={onWriteNotes}
                >
                  {t("ai.notes.from_transcript")}
                </Button>
              ) : null}
              {canEdit ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={onWriteHomework}
                >
                  {t("ai.homework.from_transcript")}
                </Button>
              ) : null}
              {canEdit ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={onWriteQuiz}
                >
                  {t("ai.quiz.from_transcript")}
                </Button>
              ) : null}
              {canEdit ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={onWriteRecommendation}
                >
                  {t("ai.recommend.from_transcript")}
                </Button>
              ) : null}
            </div>
          ) : null}
          {canRelabel ? (
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                disabled={pending}
                onClick={() => onReview("approve")}
              >
                {t("ai.approve")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => onReview("reject")}
              >
                {t("ai.reject")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function SpeakerRelabelForm({
  name,
  role,
  pending,
  onApply,
}: {
  name: string;
  role: AiSpeakerRole;
  pending: boolean;
  onApply: (speakerRole: AiSpeakerRole, speakerName: string) => void;
}) {
  const t = useT();
  const [speakerName, setSpeakerName] = useState(name);
  const [speakerRole, setSpeakerRole] = useState(role);
  return (
    <form
      className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        onApply(speakerRole, speakerName.trim());
      }}
    >
      <label className="grid gap-1 text-xs font-semibold text-muted">
        {t("ai.speakers.name")}
        <input
          value={speakerName}
          onChange={(event) => setSpeakerName(event.target.value)}
          className={fieldClass}
        />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-muted">
        {t("ai.speakers.role")}
        <select
          value={speakerRole}
          onChange={(event) => setSpeakerRole(event.target.value as AiSpeakerRole)}
          className={fieldClass}
        >
          {AI_SPEAKER_ROLES.map((item) => (
            <option key={item} value={item}>
              {t(speakerKeys[item])}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" size="sm" className="sm:mt-5" disabled={pending || !speakerName.trim()}>
        {t("ai.speakers.apply")}
      </Button>
    </form>
  );
}

function SpeechTranscriptForm({
  classrooms,
  pending,
  onSave,
  defaultLocale,
  actorName,
  actorRole,
  actorUserId,
}: {
  classrooms: AiClassroomOption[];
  pending: boolean;
  onSave: (body: unknown) => Promise<void>;
  defaultLocale: AiLocale;
  actorName: string;
  actorRole: AiSpeakerRole;
  actorUserId: string;
}) {
  const t = useT();
  const [classroomId, setClassroomId] = useState(classrooms[0]?.id ?? "");
  const [locale, setLocale] = useState<AiLocale>(defaultLocale);
  const room = classrooms.find((item) => item.id === classroomId) ?? classrooms[0];
  const speech = useLessonSpeechCapture({
    locale,
    speakerRole: actorRole,
    speakerName: actorName || t(speakerKeys[actorRole]),
    speakerUserId: actorUserId,
  });

  async function save() {
    if (!room || !speech.segments.length) return;
    speech.stop();
    await onSave({
      action: "save_speech",
      classroomId: room.id,
      recordingId: room.recordingId ?? "",
      locale,
      finalize: true,
      segments: speech.segments.map((item) => ({
        body: item.body,
        at: item.at,
        startMs: item.startMs,
        confidence: item.confidence,
        speakerRole: item.speakerRole,
        speakerName: item.speakerName,
        speakerUserId: item.speakerUserId,
      })),
    });
    speech.clear();
  }

  return (
    <div className="mt-6 grid gap-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold text-muted">
          {t("ai.lesson")}
          <select
            className={fieldClass}
            value={classroomId}
            onChange={(event) => setClassroomId(event.target.value)}
          >
            {classrooms.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-muted">
          {t("ai.locale")}
          <select
            className={fieldClass}
            value={locale}
            disabled={speech.listening}
            onChange={(event) => setLocale(event.target.value as AiLocale)}
          >
            {AI_LOCALES.map((item) => (
              <option key={item} value={item}>
                {t(item === "ar" ? "ai.locale.ar" : "ai.locale.en")}
              </option>
            ))}
          </select>
        </label>
      </div>
      {room?.recordingId && room.recordingReady ? (
        <div>
          <p className="text-sm font-semibold text-muted">{t("ai.speech.recording")}</p>
          <video
            controls
            className="mt-2 w-full rounded-2xl bg-brand"
            src={classroomRecordingPlaybackHref(room.id, room.recordingId)}
          />
          <p className="mt-2 text-sm text-muted">{t("ai.speech.recording_help")}</p>
        </div>
      ) : (
        <p className="text-sm text-muted">{t("ai.speech.no_recording")}</p>
      )}
      {locale === "ar" ? (
        <p className="text-sm text-muted">{t("ai.arabic.available")}</p>
      ) : null}
      {speech.supported ? (
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant={speech.listening ? "secondary" : "primary"}
            disabled={pending}
            onClick={() => (speech.listening ? speech.stop() : speech.start())}
          >
            {speech.listening ? t("ai.speech.stop") : t("ai.speech.start")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending || !speech.segments.length}
            onClick={() => void save()}
          >
            {t("ai.speech.save")}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted">{t("ai.speech.unsupported")}</p>
      )}
      {speech.error === "language-not-supported" ? (
        <p className="text-sm text-rose-700">{t("ai.arabic.unavailable")}</p>
      ) : speech.error ? (
        <p className="text-sm text-rose-700">{t("ai.speech.failed")}</p>
      ) : null}
      {speech.arabicFallback ? (
        <p className="text-sm text-muted">{t("ai.arabic.fallback")}</p>
      ) : null}
      {speech.listening || speech.segments.length || speech.interim ? (
        <div className="rounded-2xl bg-background px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#CB9F64]">
            {speech.listening ? t("ai.speech.live") : t("ai.speech.captured")}
          </p>
          <ol className="mt-2 grid gap-2">
            {speech.segments.map((item, index) => (
              <li key={`${item.at}-${index}`} className="text-sm text-brand" dir={locale === "ar" ? "rtl" : "ltr"}>
                <span className="font-semibold text-[#CB9F64]">{item.speakerName || actorName}</span>
                {": "}
                {item.body}
              </li>
            ))}
          </ol>
          {speech.interim ? (
            <p className="mt-2 text-sm text-muted" dir={locale === "ar" ? "rtl" : "ltr"}>
              {speech.interim}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
