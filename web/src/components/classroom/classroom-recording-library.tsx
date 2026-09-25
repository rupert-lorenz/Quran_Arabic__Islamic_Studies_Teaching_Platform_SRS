"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { patchJson } from "@/lib/api";
import { formatClassroomRecordingTime } from "@/lib/classroom-recording";
import type { ClassroomRecordingAccessView } from "@/server/classroom/recording-access";

function expiryLabel(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

export function ClassroomRecordingLibrary({
  recordings,
  retentionDays,
  emptyText,
  onChange,
}: {
  recordings: ClassroomRecordingAccessView[];
  retentionDays: number;
  emptyText?: string;
  onChange?: (next: ClassroomRecordingAccessView[]) => void;
}) {
  const [owned, setOwned] = useState(recordings);
  const list = onChange ? recordings : owned;
  const t = useT();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function toggleRetain(item: ClassroomRecordingAccessView) {
    setPending(true);
    setError("");
    try {
      const next = await patchJson<ClassroomRecordingAccessView>(
        `/api/v1/classrooms/${item.classroomId}/recordings/${item.id}`,
        { retained: !item.retained },
      );
      const updated = list.map((row) => (row.id === next.id ? next : row));
      if (onChange) onChange(updated);
      else setOwned(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("classroom.record_failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
        {t("classroom.recording_library")}
      </h2>
      <p className="mt-2 text-sm font-semibold text-muted">
        {t("classroom.recording_access")}
      </p>
      <p className="mt-1 text-sm font-semibold text-muted">
        {t("classroom.recording_kept", { days: retentionDays })}
      </p>
      {error ? <p className="mt-3 text-sm font-semibold text-brand">{error}</p> : null}
      {list.length ? (
        <ul className="mt-4 grid gap-3">
          {list.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl bg-mint px-4 py-4 text-sm font-semibold text-brand"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-extrabold">{item.title}</p>
                  <p className="mt-1 text-muted">
                    {new Date(item.startedAt).toLocaleString()}
                    {item.durationSeconds
                      ? ` · ${formatClassroomRecordingTime(item.durationSeconds)}`
                      : ""}
                    {item.retained
                      ? ` · ${t("classroom.recording_held")}`
                      : item.expiresAt
                        ? ` · ${t("classroom.recording_expires", { date: expiryLabel(item.expiresAt) })}`
                        : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setPlayingId((current) => (current === item.id ? null : item.id))
                    }
                  >
                    {playingId === item.id
                      ? t("classroom.recording_close")
                      : t("classroom.recording_watch")}
                  </Button>
                  {item.canRetain ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => void toggleRetain(item)}
                    >
                      {item.retained
                        ? t("classroom.recording_release")
                        : t("classroom.recording_retain")}
                    </Button>
                  ) : null}
                </div>
              </div>
              {playingId === item.id ? (
                <video
                  className="mt-3 w-full rounded-2xl bg-brand"
                  controls
                  playsInline
                  src={item.href}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm leading-6 text-muted">
          {emptyText ?? t("classroom.recording_none")}
        </p>
      )}
    </section>
  );
}
