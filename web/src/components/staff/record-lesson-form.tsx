"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, getJson, postJson } from "@/lib/api";
import {
  DEFAULT_LESSON_DURATION_MINUTES,
  lessonHistoryStatuses,
  type LessonHistoryView,
} from "@/lib/lesson-history";
import { LessonHistoryList } from "@/components/learning/lesson-history-list";

type LessonsResponse = { lessons: LessonHistoryView[] };

export function RecordLessonForm({
  catalog,
  initialLessons,
}: {
  catalog: { slug: string; name: string }[];
  initialLessons: LessonHistoryView[];
}) {
  const [lessons, setLessons] = useState(initialLessons);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="grid gap-6">
      <form
        ref={formRef}
        className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          setPending(true);
          setError("");
          setMessage("");
          try {
            const startedAt = String(data.get("startedAt") ?? "");
            const next = await postJson<LessonsResponse>("/api/v1/staff/lessons", {
              studentEmail: String(data.get("studentEmail") ?? ""),
              teacherEmail: String(data.get("teacherEmail") ?? "") || undefined,
              subjectSlug: String(data.get("subjectSlug") ?? "") || undefined,
              title: String(data.get("title") ?? "") || undefined,
              status: String(data.get("status") ?? "completed"),
              startedAt: startedAt ? new Date(startedAt).toISOString() : "",
              durationMinutes: Number(data.get("durationMinutes") ?? DEFAULT_LESSON_DURATION_MINUTES),
              attendedMinutes: data.get("attendedMinutes")
                ? Number(data.get("attendedMinutes"))
                : undefined,
              notes: String(data.get("notes") ?? ""),
            });
            setLessons(next.lessons);
            setMessage("Lesson recorded.");
            form.reset();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not record lesson");
          } finally {
            setPending(false);
          }
        }}
      >
        <h2 className="text-xl font-extrabold text-brand">Record a lesson</h2>
        <p className="mt-2 text-sm text-muted">
          Use this until booking writes history automatically. Students and
          parents see completed, cancelled, and missed lessons on their
          profiles.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold text-brand">
            Student email
            <input
              name="studentEmail"
              type="email"
              required
              className={fieldClass}
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-brand">
            Teacher email (optional)
            <input name="teacherEmail" type="email" className={fieldClass} />
          </label>
          <label className="grid gap-2 text-sm font-bold text-brand">
            Subject
            <select name="subjectSlug" className={fieldClass} defaultValue="">
              <option value="">Any subject</option>
              {catalog.map((subject) => (
                <option key={subject.slug} value={subject.slug}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold text-brand">
            Status
            <select name="status" className={fieldClass} defaultValue="completed">
              {lessonHistoryStatuses.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-bold text-brand">
            Date and time
            <input
              name="startedAt"
              type="datetime-local"
              required
              className={fieldClass}
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-brand">
            Duration (minutes)
            <input
              name="durationMinutes"
              type="number"
              min={15}
              max={180}
              defaultValue={DEFAULT_LESSON_DURATION_MINUTES}
              className={fieldClass}
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-brand">
            Minutes attended (optional)
            <input
              name="attendedMinutes"
              type="number"
              min={0}
              max={180}
              className={fieldClass}
              placeholder="Same as duration if present"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-brand md:col-span-2">
            Title (optional)
            <input name="title" className={fieldClass} placeholder="Tajweed lesson" />
          </label>
          <label className="grid gap-2 text-sm font-bold text-brand md:col-span-2">
            Family-visible notes
            <textarea name="notes" rows={3} className={`${fieldClass} py-3`} />
          </label>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Record lesson"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={async () => {
              const email = String(
                formRef.current
                  ? new FormData(formRef.current).get("studentEmail") ?? ""
                  : "",
              ).trim();
              setPending(true);
              setError("");
              try {
                const next = await getJson<LessonsResponse>(
                  email
                    ? `/api/v1/staff/lessons?studentEmail=${encodeURIComponent(email)}`
                    : "/api/v1/staff/lessons",
                );
                setLessons(next.lessons);
                setMessage(
                  email
                    ? "Showing this student's lessons."
                    : "Showing recent lessons.",
                );
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Could not load lessons",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            Look up history
          </Button>
        </div>
        {error ? (
          <p className="mt-4 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-4 rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-brand">
            {message}
          </p>
        ) : null}
      </form>

      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <h2 className="mb-4 text-xl font-extrabold text-brand">Recent lessons</h2>
        <LessonHistoryList lessons={lessons} />
      </section>
    </div>
  );
}
