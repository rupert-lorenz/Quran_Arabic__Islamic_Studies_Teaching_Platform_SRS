"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { fieldClass, patchJson } from "@/lib/api";

export function GroupTeachingSettings({
  initialEnabled,
  initialCapacity,
  initialMinStudents,
}: {
  initialEnabled: boolean;
  initialCapacity: number;
  initialMinStudents: number;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [capacity, setCapacity] = useState(initialCapacity);
  const [minStudents, setMinStudents] = useState(
    Math.min(initialMinStudents, initialCapacity),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="text-2xl font-extrabold text-brand">
        Group teaching availability
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Opt in to publish teacher-created group classes. Your public profile
        will show that group teaching is available. Set the usual class size
        and the minimum number of students required for a class to run.
      </p>
      <form
        className="mt-5 grid gap-4 sm:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError("");
          try {
            await patchJson("/api/v1/teacher/group-teaching", {
              offersGroupTeaching: enabled,
              defaultGroupCapacity: capacity,
              defaultGroupMinStudents: Math.min(minStudents, capacity),
            });
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save settings");
          } finally {
            setPending(false);
          }
        }}
      >
        <label className="flex items-center gap-3 rounded-2xl bg-mint/60 px-4 py-3 font-bold text-brand">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          Available for group teaching
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">
            Default class capacity
          </span>
          <input
            type="number"
            min={2}
            max={50}
            className={fieldClass}
            value={capacity}
            onChange={(event) => {
              const next = Number(event.target.value);
              setCapacity(next);
              if (minStudents > next) setMinStudents(next);
            }}
          />
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">
            Default minimum students
          </span>
          <input
            type="number"
            min={2}
            max={capacity || 50}
            className={fieldClass}
            value={minStudents}
            onChange={(event) => setMinStudents(Number(event.target.value))}
          />
        </label>
        <Button type="submit" disabled={pending} className="sm:col-span-2">
          {pending ? "Saving…" : "Save group teaching settings"}
        </Button>
      </form>
      {error ? (
        <p className="mt-3 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
    </section>
  );
}
