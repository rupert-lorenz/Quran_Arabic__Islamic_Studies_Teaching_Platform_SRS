"use client";

import { useEffect, useRef, useState } from "react";
import { useLessonSpeechCapture } from "@/components/ai/ai-speech-capture";
import { Button } from "@/components/ui/button";
import { useI18n, useT } from "@/components/i18n/i18n-provider";
import { postJson } from "@/lib/api";
import { isAiLocale, type AiLocale } from "@/lib/ai-systems";
import type { ClassroomParticipantRole } from "@/lib/classroom";

export function ClassroomSpeechCaptions({
  classroomId,
  recordingId,
  role,
  displayName,
  userId,
}: {
  classroomId: string;
  recordingId?: string | null;
  role: ClassroomParticipantRole;
  displayName: string;
  userId: string;
}) {
  const t = useT();
  const { locale: uiLocale } = useI18n();
  const [speechLocale, setSpeechLocale] = useState<AiLocale>(
    uiLocale.startsWith("ar") ? "ar" : "en",
  );
  const speech = useLessonSpeechCapture({
    locale: speechLocale,
    speakerRole: role,
    speakerName: displayName,
    speakerUserId: userId,
  });
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const segmentsRef = useRef(speech.segments);

  useEffect(() => {
    segmentsRef.current = speech.segments;
  }, [speech.segments]);

  async function flush(segments = segmentsRef.current) {
    if (!segments.length) return;
    speech.clear();
    segmentsRef.current = [];
    setSaving(true);
    setError("");
    try {
      await postJson("/api/v1/ai", {
        action: "save_speech",
        classroomId,
        recordingId: recordingId ?? "",
        locale: speechLocale,
        finalize: true,
        segments: segments.map((item) => ({
          body: item.body,
          at: item.at,
          startMs: item.startMs,
          confidence: item.confidence,
          speakerRole: item.speakerRole,
          speakerName: item.speakerName,
          speakerUserId: item.speakerUserId,
        })),
      });
      setNotice(t("classroom.speech_saved"));
    } catch (caught) {
      segmentsRef.current = segments;
      speech.replace(segments);
      setError(caught instanceof Error ? caught.message : t("classroom.speech_failed"));
    } finally {
      setSaving(false);
    }
  }

  async function toggle() {
    setNotice("");
    setError("");
    if (speech.listening) {
      speech.stop();
      await flush();
      return;
    }
    speech.start();
  }

  useEffect(() => {
    return () => {
      const leftover = segmentsRef.current;
      if (!leftover.length) return;
      void postJson("/api/v1/ai", {
        action: "save_speech",
        classroomId,
        recordingId: recordingId ?? "",
        locale: speechLocale,
        finalize: true,
        segments: leftover.map((item) => ({
          body: item.body,
          at: item.at,
          startMs: item.startMs,
          confidence: item.confidence,
          speakerRole: item.speakerRole,
          speakerName: item.speakerName,
          speakerUserId: item.speakerUserId,
        })),
      }).catch(() => undefined);
    };
  }, [classroomId, recordingId, speechLocale]);

  if (!speech.supported) {
    return (
      <p className="text-xs font-semibold text-muted">{t("classroom.speech_unsupported")}</p>
    );
  }

  const latest = speech.interim || speech.segments.at(-1)?.body || "";

  return (
    <div className="flex min-w-0 flex-col items-stretch gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="classroom-speech-locale">
          {t("ai.locale")}
        </label>
        <select
          id="classroom-speech-locale"
          className="rounded-full border border-line bg-background px-3 py-1 text-xs font-semibold text-brand"
          value={speechLocale}
          disabled={speech.listening || saving}
          onChange={(event) => {
            const next = event.target.value;
            if (isAiLocale(next)) setSpeechLocale(next);
          }}
        >
          <option value="en">{t("ai.locale.en")}</option>
          <option value="ar">{t("ai.locale.ar")}</option>
        </select>
        <Button
          type="button"
          size="sm"
          variant={speech.listening ? "secondary" : "ghost"}
          disabled={saving}
          onClick={() => void toggle()}
        >
          {saving
            ? t("classroom.speech_saving")
            : speech.listening
              ? t("classroom.speech_stop")
              : t("classroom.speech_start")}
        </Button>
      </div>
      {speech.listening || latest ? (
        <p className="max-w-xs truncate text-xs font-semibold text-brand" dir={speechLocale === "ar" ? "rtl" : "ltr"}>
          {speech.listening ? t("classroom.speech_live") : ""}
          {speech.listening && latest ? " · " : ""}
          {latest}
        </p>
      ) : null}
      {notice ? <p className="text-xs font-semibold text-brand">{notice}</p> : null}
      {speech.arabicFallback ? (
        <p className="text-xs font-semibold text-muted">{t("classroom.speech_arabic_fallback")}</p>
      ) : null}
      {error || speech.error ? (
        <p className="text-xs font-semibold text-rose-700">
          {error ||
            (speech.error === "language-not-supported"
              ? t("classroom.speech_arabic_unavailable")
              : t("classroom.speech_failed"))}
        </p>
      ) : null}
    </div>
  );
}
