"use client";

import { useState } from "react";
import { BookingCalendar } from "@/components/bookings/booking-calendar";
import { TeacherWeekCalendar } from "@/components/teachers/teacher-week-calendar";
import { getJson } from "@/lib/api";
import type { BookingWorkspaceView, TeacherCalendarState } from "@/lib/booking";

export function TeacherBookingsWorkspace({
  calendar: initialCalendar,
  bookings,
}: {
  calendar: TeacherCalendarState;
  bookings: BookingWorkspaceView;
}) {
  const [calendar, setCalendar] = useState(initialCalendar);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");

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

  return (
    <div className="space-y-6">
      <TeacherWeekCalendar
        calendar={calendar}
        pending={pending}
        onWeekChange={(from) => void loadWeek(from)}
      />
      {error ? (
        <p className="rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
      <BookingCalendar initial={bookings} role="teacher" />
    </div>
  );
}
