"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { fieldClass, getJson, postJson } from "@/lib/api";
import { detectBrowserTimeZone, withTimeZoneQuery } from "@/lib/timezone";

type Slots = {
  slots: { startsAt: string; label: string }[];
  durationOptions: number[];
};

export function LiveCourseForm({
  teacherUserId,
  subjects,
  currencyCode,
}: {
  teacherUserId: string;
  subjects: { slug: string; name: string }[];
  currencyCode: string;
}) {
  const router = useRouter();
  const [duration, setDuration] = useState(60);
  const [slots, setSlots] = useState<Slots | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void getJson<Slots>(
      withTimeZoneQuery(
        `/api/v1/teachers/${teacherUserId}/slots?durationMinutes=${duration}`,
        detectBrowserTimeZone(),
      ),
    )
      .then(setSlots)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load open times"),
      );
  }, [duration, teacherUserId]);

  return (
    <form
      className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setError("");
        try {
          await postJson("/api/v1/live-courses", {
            title: String(form.get("title") ?? ""),
            description: String(form.get("description") ?? ""),
            subjectSlug: String(form.get("subjectSlug") ?? ""),
            firstStartsAt: String(form.get("firstStartsAt") ?? ""),
            durationMinutes: duration,
            sessionCount: Number(form.get("sessionCount")),
            capacity: Number(form.get("capacity")),
            priceMajor: Number(form.get("priceMajor")),
            timeZone: detectBrowserTimeZone() ?? undefined,
          });
          event.currentTarget.reset();
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not publish live course");
        } finally {
          setPending(false);
        }
      }}
    >
      <h2 className="text-2xl font-extrabold text-brand">Publish a live course</h2>
      <p className="mt-2 text-sm text-muted">
        The first open time repeats weekly for the full course.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">Course title</span>
          <input name="title" required maxLength={160} className={fieldClass} />
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">Subject</span>
          <select name="subjectSlug" required className={fieldClass}>
            {subjects.map((subject) => (
              <option key={subject.slug} value={subject.slug}>{subject.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">Session length</span>
          <select
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
            className={fieldClass}
          >
            {(slots?.durationOptions ?? [30, 45, 60, 90]).map((minutes) => (
              <option key={minutes} value={minutes}>{minutes} minutes</option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">First session</span>
          <select name="firstStartsAt" required className={fieldClass}>
            <option value="">Choose an open time</option>
            {(slots?.slots ?? []).map((slot) => (
              <option key={slot.startsAt} value={slot.startsAt}>{slot.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">Weekly sessions</span>
          <input name="sessionCount" type="number" min={2} max={24} defaultValue={6} required className={fieldClass} />
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">Capacity</span>
          <input name="capacity" type="number" min={2} max={50} defaultValue={8} required className={fieldClass} />
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">
            Full course price ({currencyCode})
          </span>
          <input name="priceMajor" type="number" min={0} step="0.01" defaultValue={0} required className={fieldClass} />
        </label>
      </div>
      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-bold text-brand">Description</span>
        <textarea name="description" rows={4} maxLength={1500} className={fieldClass} />
      </label>
      <Button className="mt-5" disabled={pending || !slots?.slots.length}>
        {pending ? "Publishing…" : "Publish live course"}
      </Button>
      {error ? (
        <p className="mt-3 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
    </form>
  );
}
