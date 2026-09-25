"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { fieldClass, getJson, postJson } from "@/lib/api";
import {
  BOOKING_HORIZON_DAYS,
  countGroupClassSessions,
  DEFAULT_GROUP_MIN_STUDENTS,
  formatLessonDuration,
  MAX_GROUP_CLASS_CAPACITY,
  MAX_GROUP_CLASS_DAYS,
  MAX_GROUP_CLASS_SESSIONS,
  MIN_GROUP_CLASS_CAPACITY,
  resolveGroupMinStudents,
  sortedWeekdays,
  weekdayOptions,
} from "@/lib/booking";
import { splitLessonRate } from "@/lib/teacher-rate-display";
import {
  addCalendarDays,
  detectBrowserTimeZone,
  eachIsoDate,
  formatClockInTimeZone,
  isoDateDiffDays,
  isoDateWeekday,
  withTimeZoneQuery,
  zonedWeekday,
  zonedYmd,
} from "@/lib/timezone";

type Slot = {
  startsAt: string;
  label: string;
};

type SlotResponse = {
  viewerTimeZone: string;
  durationMinutes: number;
  durationOptions: number[];
  slots: Slot[];
};

function sessionIsoDates(
  startsOn: string,
  endsOn: string,
  weekdays: number[],
  weekInterval: number,
) {
  if (!weekdays.length) {
    return [];
  }
  const last = endsOn && endsOn >= startsOn ? endsOn : startsOn;
  const dates: string[] = [];
  for (const isoDate of eachIsoDate(startsOn, last)) {
    if (!weekdays.includes(isoDateWeekday(isoDate))) {
      continue;
    }
    if (Math.floor(isoDateDiffDays(startsOn, isoDate) / 7) % weekInterval !== 0) {
      continue;
    }
    dates.push(isoDate);
  }
  return dates;
}

function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function GroupLessonForm({
  teacherUserId,
  subjects,
  currencyCode,
  defaultCapacity,
  defaultMinStudents = DEFAULT_GROUP_MIN_STUDENTS,
  commissionPercent = 20,
  adminMode = false,
}: {
  teacherUserId: string;
  subjects: { slug: string; name: string }[];
  currencyCode: string;
  defaultCapacity: number;
  defaultMinStudents?: number;
  commissionPercent?: number;
  adminMode?: boolean;
}) {
  const router = useRouter();
  const [slots, setSlots] = useState<SlotResponse | null>(null);
  const [duration, setDuration] = useState(60);
  const [startsOn, setStartsOn] = useState(todayIso);
  const [endsOn, setEndsOn] = useState(todayIso);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [weekInterval, setWeekInterval] = useState(1);
  const [capacity, setCapacity] = useState(defaultCapacity);
  const [minStudents, setMinStudents] = useState(
    resolveGroupMinStudents(defaultMinStudents, defaultCapacity),
  );
  const [studentPrice, setStudentPrice] = useState("0");
  const [teacherPayment, setTeacherPayment] = useState("");
  const [visibleFrom, setVisibleFrom] = useState("");
  const [applicationDeadline, setApplicationDeadline] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const from = startsOn || todayIso();
    const requestedTo = endsOn && endsOn >= from ? endsOn : from;
    const pickerLimit = addCalendarDays(from, BOOKING_HORIZON_DAYS);
    const to = requestedTo > pickerLimit ? pickerLimit : requestedTo;
    void getJson<SlotResponse>(
      withTimeZoneQuery(
        `/api/v1/teachers/${teacherUserId}/slots?durationMinutes=${duration}&from=${from}&to=${to}`,
        detectBrowserTimeZone(),
      ),
    )
      .then((result) => {
        if (!cancelled) setSlots(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load open times");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [duration, endsOn, startsOn, teacherUserId]);

  const classTimes = useMemo(() => {
    const timeZone =
      slots?.viewerTimeZone || detectBrowserTimeZone() || "Europe/London";
    const openByDate = new Map<string, Set<string>>();
    const firstSlotByClock = new Map<string, Slot>();
    for (const slot of slots?.slots ?? []) {
      const instant = new Date(slot.startsAt);
      const weekday = zonedWeekday(instant, timeZone);
      if (weekdays.length && !weekdays.includes(weekday)) {
        continue;
      }
      const clock = formatClockInTimeZone(instant, timeZone);
      const date = zonedYmd(instant, timeZone).iso;
      const open = openByDate.get(date) ?? new Set<string>();
      open.add(clock);
      openByDate.set(date, open);
      if (!firstSlotByClock.has(clock)) {
        firstSlotByClock.set(clock, slot);
      }
    }
    const fetchedDates = [...openByDate.keys()].sort();
    const requiredDates = sessionIsoDates(
      startsOn,
      endsOn && endsOn >= startsOn ? endsOn : startsOn,
      weekdays,
      weekInterval,
    ).filter((isoDate) => {
      if (!fetchedDates.length) {
        return false;
      }
      return isoDate >= fetchedDates[0]! && isoDate <= fetchedDates[fetchedDates.length - 1]!;
    });
    return [...firstSlotByClock.entries()]
      .filter(([clock]) =>
        requiredDates.length
          ? requiredDates.every((isoDate) => openByDate.get(isoDate)?.has(clock))
          : true,
      )
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([clock, slot]) => ({ clock, startsAt: slot.startsAt }));
  }, [endsOn, slots, startsOn, weekInterval, weekdays]);

  const estimatedSessions = useMemo(
    () =>
      countGroupClassSessions({
        startsOn,
        endsOn: endsOn && endsOn >= startsOn ? endsOn : startsOn,
        weekdays,
        weekInterval,
      }),
    [endsOn, startsOn, weekInterval, weekdays],
  );
  const priceMajor = Number(studentPrice);
  const seriesTotalMajor =
    Number.isFinite(priceMajor) && priceMajor >= 0
      ? priceMajor * estimatedSessions
      : 0;
  const computedTeacherPaymentMajor =
    Number.isFinite(priceMajor) && priceMajor >= 0
      ? splitLessonRate(Math.round(priceMajor * 100), commissionPercent)
          .teacherEarnsMinor / 100
      : 0;

  function toggleDay(value: number) {
    setWeekdays((current) =>
      current.includes(value)
        ? current.filter((day) => day !== value)
        : sortedWeekdays([...current, value]),
    );
  }

  return (
    <form
      className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
      onSubmit={async (event) => {
        event.preventDefault();
        const formEl = event.currentTarget;
        const form = new FormData(formEl);
        setPending(true);
        setError("");
        setMessage("");
        try {
          await postJson(
            adminMode
              ? "/api/v1/staff/group-classes"
              : "/api/v1/group-lessons",
            {
            ...(adminMode ? { teacherUserId } : {}),
            subjectSlug: String(form.get("subjectSlug") ?? ""),
            title: String(form.get("title") ?? ""),
            description: String(form.get("description") ?? ""),
            level: String(form.get("level") ?? "all_levels"),
            minAge: String(form.get("minAge") ?? "").trim()
              ? Number(form.get("minAge"))
              : undefined,
            maxAge: String(form.get("maxAge") ?? "").trim()
              ? Number(form.get("maxAge"))
              : undefined,
            startsAt: String(form.get("startsAt") ?? ""),
            startsOn,
            endsOn: endsOn && endsOn >= startsOn ? endsOn : startsOn,
            weekdays: weekdays.length ? weekdays : undefined,
            weekInterval,
            durationMinutes: duration,
            capacity,
            minStudents: resolveGroupMinStudents(minStudents, capacity),
            studentPriceMajor: Number(studentPrice),
            ...(adminMode
              ? { teacherPaymentMajor: Number(teacherPayment) }
              : {}),
            visibleFrom: visibleFrom || undefined,
            applicationDeadline: applicationDeadline || undefined,
            timeZone: detectBrowserTimeZone() ?? undefined,
            },
          );
          formEl.reset();
          setStudentPrice("0");
          setTeacherPayment("");
          setVisibleFrom("");
          setApplicationDeadline("");
          setMessage("Class schedule published.");
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not publish group lesson");
        } finally {
          setPending(false);
        }
      }}
    >
      <h2 className="text-2xl font-extrabold text-brand">
        {adminMode ? "Create classes for this teacher" : "Publish group classes"}
      </h2>
      <p className="mt-2 text-sm text-muted">
        Set the start and end dates, choose weekdays, then pick a class time.
        That time repeats on the selected days, only inside this teacher’s
        availability, up to {MAX_GROUP_CLASS_SESSIONS} sessions or{" "}
        {Math.floor(MAX_GROUP_CLASS_DAYS / 7)} weeks.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">Title</span>
          <input name="title" required minLength={3} maxLength={160} className={fieldClass} />
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">Subject</span>
          <select name="subjectSlug" required className={fieldClass}>
            {subjects.map((subject) => (
              <option key={subject.slug} value={subject.slug}>
                {subject.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">Start date</span>
          <input
            type="date"
            required
            className={fieldClass}
            value={startsOn}
            onChange={(event) => {
              const next = event.target.value;
              setStartsOn(next);
              if (!endsOn || endsOn < next) setEndsOn(next);
            }}
          />
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">End date</span>
          <input
            type="date"
            required
            min={startsOn}
            max={addCalendarDays(startsOn, MAX_GROUP_CLASS_DAYS)}
            className={fieldClass}
            value={endsOn}
            onChange={(event) => setEndsOn(event.target.value)}
          />
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">
            Visible from (optional)
          </span>
          <input
            type="date"
            max={startsOn}
            className={fieldClass}
            value={visibleFrom}
            onChange={(event) => setVisibleFrom(event.target.value)}
          />
          <span className="mt-1 block text-xs font-semibold text-muted">
            Families cannot see this class before this date. Leave empty to show it immediately.
          </span>
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">
            Application deadline (optional)
          </span>
          <input
            type="date"
            min={visibleFrom || undefined}
            max={startsOn}
            className={fieldClass}
            value={applicationDeadline}
            onChange={(event) => setApplicationDeadline(event.target.value)}
          />
          <span className="mt-1 block text-xs font-semibold text-muted">
            Enrolment closes at the end of this day. Leave empty to keep applications open until the first class.
          </span>
        </label>
        <div className="md:col-span-2">
          <p className="mb-2 text-sm font-bold text-brand">Weekdays</p>
          <div className="flex flex-wrap gap-2">
            {weekdayOptions.map((day) => {
              const selected = weekdays.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  className={`min-h-11 rounded-full px-4 text-sm font-bold ${
                    selected ? "bg-brand text-white" : "bg-mint text-brand"
                  }`}
                  onClick={() => toggleDay(day.value)}
                >
                  {day.label.slice(0, 3)}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs font-semibold text-muted">
            Leave empty to use the weekday of the chosen class time.
          </p>
        </div>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">Repeat</span>
          <select
            className={fieldClass}
            value={weekInterval}
            onChange={(event) => setWeekInterval(Number(event.target.value))}
          >
            <option value={1}>Every week</option>
            <option value={2}>Every 2 weeks</option>
            <option value={3}>Every 3 weeks</option>
            <option value={4}>Every 4 weeks</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">Level</span>
          <select name="level" className={fieldClass} defaultValue="all_levels">
            <option value="all_levels">All levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">
            Minimum age (optional)
          </span>
          <input
            name="minAge"
            type="number"
            min={3}
            max={99}
            className={fieldClass}
            placeholder="All ages"
          />
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">
            Maximum age (optional)
          </span>
          <input
            name="maxAge"
            type="number"
            min={3}
            max={99}
            className={fieldClass}
            placeholder="All ages"
          />
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">Lesson length</span>
          <select
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
            className={fieldClass}
          >
            {(slots?.durationOptions ?? [30, 45, 60, 90]).map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatLessonDuration(minutes)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">Class time</span>
          <select name="startsAt" required className={fieldClass}>
            <option value="">Choose a class time</option>
            {classTimes.map((slot) => (
              <option key={slot.clock} value={slot.startsAt}>
                {slot.clock}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-semibold text-muted">
            Only the clock time. Dates come from the start date, end date, and weekdays above.
          </span>
          {classTimes.length ? null : (
            <span className="mt-2 block rounded-2xl bg-gold px-3 py-2 text-sm font-semibold text-brand">
              No open class times in that range. Change the dates or weekdays so they
              fall inside your availability, then publish again.
            </span>
          )}
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">Capacity</span>
          <input
            type="number"
            min={MIN_GROUP_CLASS_CAPACITY}
            max={MAX_GROUP_CLASS_CAPACITY}
            value={capacity}
            required
            className={fieldClass}
            onChange={(event) => {
              const next = Number(event.target.value);
              setCapacity(next);
              if (minStudents > next) setMinStudents(next);
            }}
          />
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">
            Minimum students
          </span>
          <input
            type="number"
            min={MIN_GROUP_CLASS_CAPACITY}
            max={capacity || MAX_GROUP_CLASS_CAPACITY}
            value={minStudents}
            required
            className={fieldClass}
            onChange={(event) => setMinStudents(Number(event.target.value))}
          />
          <span className="mt-1 block text-xs font-semibold text-muted">
            The class is cancelled at start time if fewer students are enrolled.
          </span>
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">
            Student price per session ({currencyCode})
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={studentPrice}
            required
            className={fieldClass}
            onChange={(event) => setStudentPrice(event.target.value)}
          />
          <span className="mt-1 block text-xs font-semibold text-muted">
            This is what each student pays for one session.
          </span>
          {Number.isFinite(priceMajor) && priceMajor >= 0 ? (
            <span className="mt-2 block rounded-2xl bg-mint px-3 py-2 text-sm font-semibold text-brand">
              {estimatedSessions > 1
                ? `Students pay ${priceMajor.toFixed(2)} ${currencyCode} per session · ${estimatedSessions} sessions · ${seriesTotalMajor.toFixed(2)} ${currencyCode} total`
                : `Students pay ${priceMajor.toFixed(2)} ${currencyCode} per session`}
            </span>
          ) : null}
          {estimatedSessions > MAX_GROUP_CLASS_SESSIONS ? (
            <span className="mt-2 block rounded-2xl bg-gold px-3 py-2 text-sm font-semibold text-brand">
              This range creates {estimatedSessions} sessions. Shorten the end
              date or choose fewer weekdays. The limit is{" "}
              {MAX_GROUP_CLASS_SESSIONS}.
            </span>
          ) : null}
        </label>
        {adminMode ? (
          <label>
            <span className="mb-1 block text-sm font-bold text-brand">
              Teacher payment per session ({currencyCode})
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={teacherPayment}
              required
              className={fieldClass}
              onChange={(event) => setTeacherPayment(event.target.value)}
            />
            <span className="mt-1 block text-xs font-semibold text-muted">
              Internal. Students never see this amount.
            </span>
          </label>
        ) : Number.isFinite(priceMajor) && priceMajor >= 0 ? (
          <p className="rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-brand">
            You earn {computedTeacherPaymentMajor.toFixed(2)} {currencyCode} per
            session after a {commissionPercent}% platform commission
            {estimatedSessions > 1
              ? ` · ${estimatedSessions} sessions · ${(computedTeacherPaymentMajor * estimatedSessions).toFixed(2)} ${currencyCode} total`
              : ""}
            . Students never see this.
          </p>
        ) : null}
        <label className="md:col-span-2 max-w-2xl min-w-0">
          <span className="mb-1 block text-sm font-bold text-brand">Description</span>
          <textarea
            name="description"
            rows={4}
            maxLength={1000}
            className={`${fieldClass} box-border py-3 pe-5`}
          />
        </label>
      </div>
      <Button
        className="mt-5"
        disabled={
          pending ||
          !classTimes.length ||
          estimatedSessions > MAX_GROUP_CLASS_SESSIONS
        }
      >
        {pending ? "Publishing…" : "Publish class schedule"}
      </Button>
      {message ? (
        <p className="mt-3 rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-brand">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
    </form>
  );
}
