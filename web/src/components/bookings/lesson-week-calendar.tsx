"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import type { LessonCalendarEvent, LessonCalendarState } from "@/lib/booking";
import { formatHm } from "@/lib/timezone";
import type { UiMessageKey } from "@/lib/i18n";

const HOUR_PX = 56;
const DOW_KEYS = [
  "cal.dow_0",
  "cal.dow_1",
  "cal.dow_2",
  "cal.dow_3",
  "cal.dow_4",
  "cal.dow_5",
  "cal.dow_6",
] as const satisfies readonly UiMessageKey[];

export function LessonWeekCalendar({
  calendar,
  pending,
  onWeekChange,
}: {
  calendar: LessonCalendarState;
  pending: string;
  onWeekChange: (from: string) => void;
}) {
  const t = useT();
  const [selected, setSelected] = useState<LessonCalendarEvent | null>(null);
  const hours = useMemo(() => {
    const rows: number[] = [];
    for (let minute = calendar.hourStart; minute < calendar.hourEnd; minute += 60) {
      rows.push(minute);
    }
    return rows;
  }, [calendar.hourEnd, calendar.hourStart]);
  const totalHeight = ((calendar.hourEnd - calendar.hourStart) / 60) * HOUR_PX;
  const minutePx = HOUR_PX / 60;
  const busy = Boolean(pending);

  function openEvent(event: LessonCalendarEvent) {
    setSelected(event);
    if (event.bookingId) {
      document
        .getElementById(`booking-${event.bookingId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-brand">{t("booking.week_title")}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            {calendar.weekLabel} · {calendar.timezone}
          </p>
          <p className="mt-1 text-sm font-semibold text-brand">
            {t("booking.week_summary", { count: calendar.summary.booked })}
            {calendar.summary.cancelled
              ? ` · ${t("booking.week_cancelled", { count: calendar.summary.cancelled })}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => onWeekChange(calendar.prevWeekStart)}
          >
            {t("booking.week_prev")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => onWeekChange(calendar.todayIso)}
          >
            {t("booking.week_this")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => onWeekChange(calendar.nextWeekStart)}
          >
            {t("booking.week_next")}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold uppercase tracking-wide text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-brand" /> {t("booking.legend_lesson")}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-gold" /> {t("group.badge")}
        </span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[52rem]">
          <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] gap-1">
            <div />
            {calendar.days.map((day) => (
              <div
                key={day.isoDate}
                className={`rounded-2xl px-2 py-2 text-center ${
                  day.isToday ? "bg-mint" : "bg-background"
                }`}
              >
                <p className="text-xs font-bold uppercase text-brand-soft">
                  {t(DOW_KEYS[day.weekday] ?? "cal.dow_1")}
                </p>
                <p className="text-lg font-extrabold text-brand">{day.dayNumber}</p>
                <p className="text-xs font-semibold text-muted">
                  {day.lessonCount
                    ? t("booking.day_lessons", { count: day.lessonCount })
                    : t("booking.day_empty")}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] gap-1">
            <div className="relative" style={{ height: totalHeight }}>
              {hours.map((minute) => (
                <div
                  key={minute}
                  className="absolute right-1 text-[11px] font-bold text-muted"
                  style={{ top: ((minute - calendar.hourStart) / 60) * HOUR_PX - 7 }}
                >
                  {formatHm(minute)}
                </div>
              ))}
            </div>
            {calendar.days.map((day) => (
              <div
                key={day.isoDate}
                className="relative overflow-hidden rounded-2xl bg-background"
                style={{ height: totalHeight }}
              >
                {hours.map((minute) => (
                  <div
                    key={minute}
                    className="pointer-events-none absolute inset-x-0 border-t border-line/70"
                    style={{ top: ((minute - calendar.hourStart) / 60) * HOUR_PX }}
                  />
                ))}
                {day.isToday &&
                calendar.nowMinute != null &&
                calendar.nowMinute >= calendar.hourStart &&
                calendar.nowMinute <= calendar.hourEnd ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-brand"
                    style={{ top: (calendar.nowMinute - calendar.hourStart) * minutePx }}
                  />
                ) : null}
                {day.events.map((event) => {
                  const muted = event.status === "cancelled" || event.status === "no_show";
                  return (
                    <button
                      key={event.id}
                      type="button"
                      className={`absolute inset-x-1 z-10 overflow-hidden rounded-xl border px-2 py-1 text-left ${
                        event.type === "group"
                          ? "border-amber-300 bg-gold text-brand"
                          : "border-brand/20 bg-brand text-white"
                      } ${
                        muted ? "opacity-45" : ""
                      }`}
                      style={{
                        top: (event.startMinute - calendar.hourStart) * minutePx + 1,
                        height: Math.max(
                          28,
                          (event.endMinute - event.startMinute) * minutePx - 2,
                        ),
                        zIndex: 15,
                      }}
                      title={event.detail ?? event.title}
                      onClick={() => openEvent(event)}
                    >
                      <span className="block truncate text-[11px] font-extrabold leading-4">
                        {event.startTime}–{event.endTime}
                      </span>
                      {event.teacherTime ? (
                        <span className="block truncate text-[10px] font-semibold leading-4 opacity-80">
                          {event.teacherTime} {event.teacherTimezone}
                        </span>
                      ) : null}
                      <span className="block truncate text-[11px] font-semibold leading-4">
                        {event.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {selected ? (
        <div className="mt-4 rounded-2xl bg-mint/70 px-4 py-4">
          <p className="text-sm font-bold uppercase text-brand-soft">{selected.title}</p>
          <p className="mt-1 text-lg font-extrabold text-brand">
            {selected.startTime}–{selected.endTime}
          </p>
          {selected.teacherTime ? (
            <p className="text-sm font-semibold text-muted">
              {t("booking.teacher_time", {
                time: selected.teacherTime,
                zone: selected.teacherTimezone ?? "",
              })}
            </p>
          ) : null}
          {selected.detail ? <p className="mt-1 text-sm text-muted">{selected.detail}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {selected.classroomJoinable && selected.classroomHref ? (
              <Button
                type="button"
                onClick={() => window.location.assign(selected.classroomHref!)}
              >
                {t("classroom.join")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (selected.bookingId) {
                  document
                    .getElementById(`booking-${selected.bookingId}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" });
                } else {
                  window.location.assign(selected.href);
                }
              }}
            >
              {t("booking.open_lesson")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setSelected(null)}>
              {t("booking.close")}
            </Button>
          </div>
        </div>
      ) : calendar.summary.booked === 0 && calendar.summary.cancelled === 0 ? (
        <p className="mt-4 text-sm leading-6 text-muted">{t("booking.week_empty")}</p>
      ) : null}
    </section>
  );
}
