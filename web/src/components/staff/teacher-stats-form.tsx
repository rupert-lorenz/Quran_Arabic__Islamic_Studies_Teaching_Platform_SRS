"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, patchJson } from "@/lib/api";
import { buildTeacherStats, type TeacherStats } from "@/lib/teacher-reputation";

type TeacherStatsTarget = {
  userId: string;
  lessonsTaught: number;
  responseRate: number | null;
  stats: TeacherStats;
};

export function TeacherStatsForm<T extends TeacherStatsTarget>({
  application,
  onUpdated,
}: {
  application: T;
  onUpdated: (next: T) => void;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mt-6 rounded-[2rem] border border-line bg-surface p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const lessonsValue = String(form.get("lessonsTaught") ?? "").trim();
        const responseValue = String(form.get("responseRate") ?? "").trim();
        setPending(true);
        setError("");
        try {
          const next = await patchJson<{
            lessonsTaught: number;
            responseRate: number | null;
          }>(`/api/v1/staff/teachers/${application.userId}/stats`, {
            lessonsTaught: lessonsValue === "" ? undefined : Number(lessonsValue),
            responseRate: responseValue === "" ? undefined : Number(responseValue),
          });
          const stats: TeacherStats = buildTeacherStats({
            averageRating: application.stats.averageRating,
            reviewCount: application.stats.reviewCount,
            recommendPercent: application.stats.recommendPercent,
            lessonsTaught: next.lessonsTaught,
            responseRate: next.responseRate,
          });
          onUpdated({
            ...application,
            lessonsTaught: next.lessonsTaught,
            responseRate: next.responseRate,
            stats,
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not update stats");
        } finally {
          setPending(false);
        }
      }}
    >
      <h3 className="text-lg font-extrabold text-brand">Marketplace stats</h3>
      <p className="mt-1 text-sm text-muted">
        Lesson count and response rate stay staff-set until bookings and
        messaging are live.
      </p>
      {error ? (
        <p className="mt-3 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">
            Lessons taught
          </span>
          <input
            name="lessonsTaught"
            type="number"
            min={0}
            defaultValue={application.lessonsTaught}
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">
            Response rate %
          </span>
          <input
            name="responseRate"
            type="number"
            min={0}
            max={100}
            defaultValue={application.responseRate ?? ""}
            className={fieldClass}
          />
        </label>
      </div>
      <div className="mt-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save stats"}
        </Button>
      </div>
    </form>
  );
}
