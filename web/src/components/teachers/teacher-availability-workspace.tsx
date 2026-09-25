"use client";

import { useState } from "react";
import { TeacherAvailabilityForm } from "@/components/teachers/teacher-availability-form";
import { TeacherWeekCalendar } from "@/components/teachers/teacher-week-calendar";
import { deleteJson, getJson, patchJson, postJson } from "@/lib/api";
import type { TeacherCalendarState } from "@/lib/booking";

export function TeacherAvailabilityWorkspace({
  initial,
}: {
  initial: TeacherCalendarState;
}) {
  const [calendar, setCalendar] = useState(initial);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState("");

  async function loadWeek(from: string) {
    setPending(`week:${from}`);
    setError("");
    try {
      const next = await getJson<TeacherCalendarState>(
        `/api/v1/teacher/calendar?from=${from}`,
      );
      setCalendar(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load calendar");
    } finally {
      setPending("");
    }
  }

  async function run(label: string, work: () => Promise<unknown>) {
    setPending(label);
    setError("");
    setMessage("");
    try {
      await work();
      const next = await getJson<TeacherCalendarState>(
        `/api/v1/teacher/calendar?from=${calendar.weekStart}`,
      );
      setCalendar(next);
      setMessage("Availability saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save availability");
    } finally {
      setPending("");
    }
  }

  return (
    <div className="space-y-6">
      <TeacherWeekCalendar
        calendar={calendar}
        manage
        pending={pending}
        onWeekChange={(from) => void loadWeek(from)}
        onAdd={(body) =>
          void run("calendar-add", () =>
            postJson("/api/v1/teacher/availability", body),
          )
        }
        onRemoveWindow={(id) =>
          void run(`remove:${id}`, () =>
            deleteJson(`/api/v1/teacher/availability/${id}`),
          )
        }
      />
      <TeacherAvailabilityForm
        state={calendar}
        pending={pending}
        onTimezone={(timezone) =>
          void run("timezone", () =>
            patchJson("/api/v1/teacher/availability", { timezone }),
          )
        }
        onNotice={(minNoticeMinutes) =>
          void run("notice", () =>
            patchJson("/api/v1/teacher/availability", { minNoticeMinutes }),
          )
        }
        onCommitment={(minCommitmentLessons) =>
          void run("commitment", () =>
            patchJson("/api/v1/teacher/availability", {
              minCommitmentLessons,
            }),
          )
        }
        onAdd={(body) =>
          void run(String(body.kind ?? "weekly"), () =>
            postJson("/api/v1/teacher/availability", body),
          )
        }
        onUpdate={(id, body) =>
          void run(`update:${id}`, () =>
            patchJson(`/api/v1/teacher/availability/${id}`, body),
          )
        }
        onRemove={(id) =>
          void run(`remove:${id}`, () =>
            deleteJson(`/api/v1/teacher/availability/${id}`),
          )
        }
        onRemoveGroup={(id) =>
          void run(`remove-group:${id}`, () =>
            deleteJson(`/api/v1/teacher/availability/${id}?scope=group`),
          )
        }
      />
      {error ? (
        <p className="rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-brand">
          {message}
        </p>
      ) : null}
    </div>
  );
}
