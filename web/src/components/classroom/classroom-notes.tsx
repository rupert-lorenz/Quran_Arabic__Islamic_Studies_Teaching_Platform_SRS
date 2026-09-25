"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useI18n, useT } from "@/components/i18n/i18n-provider";
import { fieldClass, getJson, postJson } from "@/lib/api";
import type { AiNoteView, AiSystemsDesk } from "@/server/ai/service";

function pickNote(notes: AiNoteView[], classroomId: string, locale: "en" | "ar") {
  const mine = notes.filter((item) => item.classroomId === classroomId);
  return mine.find((item) => item.locale === locale) ?? mine[0] ?? null;
}

export function ClassroomNotes({ classroomId }: { classroomId: string }) {
  const t = useT();
  const { locale } = useI18n();
  const noteLocale = locale.startsWith("ar") ? "ar" : "en";
  const [note, setNote] = useState<AiNoteView | null>(null);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void getJson<AiSystemsDesk>("/api/v1/ai")
      .then((desk) => {
        if (cancelled) return;
        const current = pickNote(desk.notes, classroomId, noteLocale);
        setNote(current);
        setBody(current?.body ?? "");
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setError(t("classroom.notes_failed"));
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [classroomId, noteLocale, t]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = body.trim();
    if (next.length < 8 || pending) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const desk = await postJson<AiSystemsDesk>("/api/v1/ai", {
        action: "save_typed_notes",
        classroomId,
        locale: noteLocale,
        body: next,
      });
      const current = pickNote(desk.notes, classroomId, noteLocale);
      setNote(current);
      setBody(current?.body ?? next);
      setMessage(t("classroom.notes_saved"));
    } catch {
      setError(t("classroom.notes_failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <h3 className="text-xs font-extrabold uppercase text-brand-soft">
        {t("classroom.notes")}
      </h3>
      <p className="mt-1 text-xs font-semibold text-muted">{t("classroom.notes_help")}</p>
      <form className="mt-3 grid gap-2" onSubmit={(event) => void submit(event)}>
        <label className="sr-only" htmlFor="classroom-notes">
          {t("classroom.notes")}
        </label>
        <textarea
          id="classroom-notes"
          name="body"
          rows={5}
          required
          minLength={8}
          disabled={!loaded || pending}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className={`${fieldClass} min-h-28 py-3 text-sm`}
          placeholder={t("classroom.notes_placeholder")}
        />
        <Button type="submit" size="sm" disabled={!loaded || pending || body.trim().length < 8}>
          {t("classroom.notes_save")}
        </Button>
      </form>
      {note ? (
        <p className="mt-2 text-xs font-semibold text-muted">{t("classroom.notes_private")}</p>
      ) : null}
      {message ? <p className="mt-2 text-xs font-semibold text-brand">{message}</p> : null}
      {error ? <p className="mt-2 text-xs font-semibold text-rose-700">{error}</p> : null}
    </div>
  );
}
