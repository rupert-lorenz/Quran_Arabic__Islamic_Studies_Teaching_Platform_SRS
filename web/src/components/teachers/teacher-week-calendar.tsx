"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/lib/api";
import { formatNoticeDuration, type TeacherCalendarEvent, type TeacherCalendarState } from "@/lib/booking";
import { formatHm } from "@/lib/timezone";

const HOUR_PX = 56;
const SNAP_MINUTES = 30;

const eventClass: Record<TeacherCalendarEvent["type"], string> = {
  hours: "border-emerald-200 bg-mint text-brand",
  extra: "border-amber-200 bg-gold text-brand",
  block: "border-rose-200 bg-rose text-brand",
  break: "border-slate-300 bg-slate-100 text-brand",
  booking: "border-brand/20 bg-brand text-white",
  group: "border-amber-300 bg-amber-100 text-brand",
};

function eventLayout(
  startMinute: number,
  endMinute: number,
  hourStart: number,
  hourEnd: number,
  minutePx: number,
) {
  const visibleStart = Math.max(startMinute, hourStart);
  const visibleEnd = Math.min(endMinute, hourEnd);
  const durationPx = Math.max(0, (visibleEnd - visibleStart) * minutePx - 2);
  return {
    top: (visibleStart - hourStart) * minutePx + 1,
    height: Math.max(durationPx, durationPx > 0 ? 36 : 0),
    compact: durationPx < 40,
    hidden: visibleEnd <= visibleStart,
  };
}

function snapMinute(value: number, hourStart: number, hourEnd: number) {
  const snapped = Math.round(value / SNAP_MINUTES) * SNAP_MINUTES;
  return Math.min(hourEnd - SNAP_MINUTES, Math.max(hourStart, snapped));
}

export type CalendarComposer = {
  kind: "recurring" | "extra" | "block" | "break";
  isoDate: string;
  weekday: number;
  weekdayLabel: string;
  startTime: string;
  endTime: string;
  note: string;
  replacesRecurring: boolean;
  allDay: boolean;
};

export function TeacherWeekCalendar({
  calendar,
  manage = false,
  pending,
  onWeekChange,
  onAdd,
  onRemoveWindow,
}: {
  calendar: TeacherCalendarState;
  manage?: boolean;
  pending: string;
  onWeekChange: (from: string) => void;
  onAdd?: (body: {
    kind: "recurring" | "extra" | "block" | "break";
    weekday?: number;
    weekdays?: number[];
    localDate?: string;
    startTime: string;
    endTime: string;
    startsOn?: string;
    weekInterval?: number;
    replacesRecurring?: boolean;
    allDay?: boolean;
    note?: string;
  }) => void;
  onRemoveWindow?: (id: string) => void;
}) {
  const [composer, setComposer] = useState<CalendarComposer | null>(null);
  const [selected, setSelected] = useState<TeacherCalendarEvent | null>(null);
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

  function openComposer(day: TeacherCalendarState["days"][number], startMinute: number) {
    const duration = Math.max(SNAP_MINUTES, calendar.lessonDurationMinutes);
    const start = snapMinute(startMinute, calendar.hourStart, calendar.hourEnd);
    const end = Math.min(calendar.hourEnd, start + duration);
    setSelected(null);
    setComposer({
      kind: "extra",
      isoDate: day.isoDate,
      weekday: day.weekday,
      weekdayLabel: day.weekdayLabel,
      startTime: formatHm(start),
      endTime: formatHm(end),
      note: "",
      replacesRecurring: false,
      allDay: false,
    });
  }

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-brand">Week calendar</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            {calendar.weekLabel} · {calendar.timezone}
            {calendar.notice
              ? calendar.notice.effectiveMinutes > 0
                ? ` · book from ${formatNoticeDuration(calendar.notice.effectiveMinutes)} ahead`
                : " · no minimum booking notice"
              : ""}
          </p>
          <p className="mt-1 text-sm font-semibold text-brand">
            {calendar.summary.booked} booked · {calendar.summary.openSlots} open slots ·{" "}
            {calendar.summary.blocked} blocked · {calendar.summary.weeklyWindows} working-hour windows
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => onWeekChange(calendar.prevWeekStart)}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => onWeekChange(calendar.todayIso)}
          >
            This week
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => onWeekChange(calendar.nextWeekStart)}
          >
            Next
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold uppercase tracking-wide text-muted">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-mint" /> Working hours
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-gold" /> Individual
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-slate-200" /> Break
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-rose" /> Blocked / holiday
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-brand" /> Lesson
        </span>
      </div>

      {manage ? (
        <p className="mt-3 text-sm leading-6 text-muted">
          Click an empty time to add individual hours, working hours, a break, or a block.
          Individual hours can replace the weekly template for that weekday from
          this date.
        </p>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[52rem]">
          <div className="grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] gap-1">
            <div />
            {calendar.days.map((day) => (
              <div
                key={day.isoDate}
                className={`rounded-2xl px-2 py-2 text-center ${
                  day.holidays?.length ? "bg-rose" : day.isToday ? "bg-mint" : "bg-background"
                }`}
              >
                <p className="text-xs font-bold uppercase text-brand-soft">{day.weekdayShort}</p>
                <p className="text-lg font-extrabold text-brand">{day.dayNumber}</p>
                {day.holidays?.length ? (
                  <button
                    type="button"
                    className="mt-1 w-full truncate text-[10px] font-bold text-brand"
                    title={day.holidays[0].detail ?? day.holidays[0].title}
                    onClick={() => {
                      const holiday = day.holidays[0];
                      setComposer(null);
                      setSelected({
                        id: holiday.id,
                        type: "block",
                        title: holiday.title,
                        detail: holiday.detail,
                        startMinute: 0,
                        endMinute: 24 * 60,
                        startTime: "00:00",
                        endTime: "24:00",
                        windowId: holiday.windowId,
                        allDay: true,
                      });
                    }}
                  >
                    {day.holidays[0].title}
                  </button>
                ) : (
                  <p className="text-xs font-semibold text-muted">{day.openSlotCount} open</p>
                )}
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
                className={`relative overflow-hidden rounded-2xl ${
                  day.holidays?.length ? "bg-rose/50" : "bg-background"
                } ${manage ? "cursor-crosshair" : ""}`}
                style={{ height: totalHeight }}
                onClick={(event) => {
                  if (!manage) {
                    return;
                  }
                  if ((event.target as HTMLElement).closest("[data-calendar-event]")) {
                    return;
                  }
                  const rect = event.currentTarget.getBoundingClientRect();
                  const startMinute =
                    calendar.hourStart + ((event.clientY - rect.top) / HOUR_PX) * 60;
                  openComposer(day, startMinute);
                }}
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
                  const layout = eventLayout(
                    event.startMinute,
                    event.endMinute,
                    calendar.hourStart,
                    calendar.hourEnd,
                    minutePx,
                  );
                  if (layout.hidden) {
                    return null;
                  }
                  const muted = event.status === "cancelled" || event.status === "no_show";
                  const body = layout.compact ? (
                    <span className="block truncate text-[10px] font-bold leading-tight">
                      {event.startTime}–{event.endTime} {event.title}
                    </span>
                  ) : (
                    <>
                      <span className="block truncate text-[11px] font-extrabold leading-4">
                        {event.startTime}–{event.endTime}
                      </span>
                      <span className="block truncate text-[11px] font-semibold leading-4">
                        {event.title}
                      </span>
                      {event.detail ? (
                        <span className="mt-0.5 block truncate text-[10px] leading-tight text-current/80">
                          {event.detail}
                        </span>
                      ) : null}
                    </>
                  );
                  const className = `absolute inset-x-1 z-10 overflow-hidden rounded-xl border px-1.5 py-0.5 text-left ${
                    eventClass[event.type]
                  } ${muted ? "opacity-45" : ""} ${
                    event.type === "booking" || event.type === "group" || manage
                      ? "cursor-pointer"
                      : "cursor-default"
                  }`;
                  const style = {
                    top: layout.top,
                    height: layout.height,
                    zIndex:
                      event.type === "booking" || event.type === "group" ? 15 : 10,
                  };
                  const title = [event.title, event.detail].filter(Boolean).join(" · ");
                  if (
                    (event.type === "booking" || event.type === "group") &&
                    event.href
                  ) {
                    return (
                      <Link
                        key={event.id}
                        href={event.href}
                        data-calendar-event
                        className={className}
                        style={style}
                        title={title}
                        onClick={() => setSelected(event)}
                      >
                        {body}
                      </Link>
                    );
                  }
                  return (
                    <button
                      key={event.id}
                      type="button"
                      data-calendar-event
                      className={className}
                      style={style}
                      title={title}
                      onClick={() => {
                        setComposer(null);
                        setSelected(event);
                      }}
                    >
                      {body}
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
            {selected.allDay ? "All day" : `${selected.startTime}–${selected.endTime}`}
          </p>
          {selected.detail ? <p className="mt-1 text-sm text-muted">{selected.detail}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {selected.classroomJoinable && selected.classroomHref ? (
              <ButtonLinkSafe href={selected.classroomHref}>
                Join classroom
              </ButtonLinkSafe>
            ) : null}
            {selected.bookingId ? (
              <ButtonLinkSafe href={`/teach/bookings#booking-${selected.bookingId}`}>
                Open lesson
              </ButtonLinkSafe>
            ) : null}
            {manage && selected.windowId ? (
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  onRemoveWindow?.(selected.windowId!);
                  setSelected(null);
                }}
              >
                {pending === `remove:${selected.windowId}` ? "Removing…" : "Remove window"}
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
        </div>
      ) : null}

      {manage && composer ? (
        <form
          className="mt-4 grid gap-3 rounded-2xl bg-background p-4 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={(event) => {
            event.preventDefault();
            onAdd?.(
              composer.kind === "recurring" || composer.kind === "break"
                ? {
                    kind: composer.kind,
                    weekday: composer.weekday,
                    startTime: composer.startTime,
                    endTime: composer.endTime,
                    startsOn: composer.isoDate,
                    weekInterval: 1,
                    note: composer.note.trim() || undefined,
                  }
                : {
                    kind: composer.kind,
                    localDate: composer.isoDate,
                    startTime: composer.startTime,
                    endTime: composer.endTime,
                    replacesRecurring:
                      composer.kind === "extra" ? composer.replacesRecurring : undefined,
                    allDay: composer.kind === "block" ? composer.allDay : undefined,
                    note: composer.note.trim() || undefined,
                  },
            );
            setComposer(null);
          }}
        >
          <label className="block lg:col-span-1">
            <span className="mb-1 block text-sm font-bold text-brand">Add</span>
            <select
              className={fieldClass}
              value={composer.kind}
              onChange={(event) =>
                setComposer({
                  ...composer,
                  kind: event.target.value as CalendarComposer["kind"],
                })
              }
            >
              <option value="extra">Individual hours on {composer.isoDate}</option>
              <option value="block">Block / holiday on {composer.isoDate}</option>
              <option value="recurring">
                Working hours every {composer.weekdayLabel} from {composer.isoDate}
              </option>
              <option value="break">
                Break every {composer.weekdayLabel} from {composer.isoDate}
              </option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">From</span>
            <input
              className={fieldClass}
              value={composer.startTime}
              onChange={(event) =>
                setComposer({ ...composer, startTime: event.target.value })
              }
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">To</span>
            <input
              className={fieldClass}
              value={composer.endTime}
              onChange={(event) => setComposer({ ...composer, endTime: event.target.value })}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">Note</span>
            <input
              className={fieldClass}
              value={composer.note}
              onChange={(event) => setComposer({ ...composer, note: event.target.value })}
              placeholder={composer.kind === "break" ? "Lunch, Jummah…" : "Optional"}
            />
          </label>
          {composer.kind === "block" ? (
            <label className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
              <input
                type="checkbox"
                className="h-5 w-5 accent-brand"
                checked={composer.allDay}
                onChange={(event) =>
                  setComposer({
                    ...composer,
                    allDay: event.target.checked,
                    startTime: event.target.checked ? "00:00" : composer.startTime,
                    endTime: event.target.checked ? "24:00" : composer.endTime,
                  })
                }
              />
              <span className="text-sm font-semibold text-brand">All day / holiday</span>
            </label>
          ) : null}
          {composer.kind === "extra" ? (
            <label className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
              <input
                type="checkbox"
                className="h-5 w-5 accent-brand"
                checked={composer.replacesRecurring}
                onChange={(event) =>
                  setComposer({ ...composer, replacesRecurring: event.target.checked })
                }
              />
              <span className="text-sm font-semibold text-brand">
                Replace weekly hours for this weekday from this date
              </span>
            </label>
          ) : null}
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
            <Button type="submit" disabled={busy}>
              {pending === "calendar-add" ? "Adding…" : "Add"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setComposer(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function ButtonLinkSafe({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-brand/15 bg-surface px-4 text-sm font-semibold text-brand hover:border-brand/30 hover:bg-white"
    >
      {children}
    </Link>
  );
}
