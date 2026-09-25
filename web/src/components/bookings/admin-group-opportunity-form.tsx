"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { fieldClass, postJson } from "@/lib/api";
import {
  countGroupClassSessions,
  DEFAULT_GROUP_CLASS_CAPACITY,
  DEFAULT_GROUP_MIN_STUDENTS,
  formatLessonDuration,
  LESSON_DURATION_OPTIONS_MINUTES,
  MAX_GROUP_CLASS_CAPACITY,
  MAX_GROUP_CLASS_DAYS,
  MAX_GROUP_CLASS_SESSIONS,
  MIN_GROUP_CLASS_CAPACITY,
  resolveGroupMinStudents,
  sortedWeekdays,
  weekdayOptions,
} from "@/lib/booking";
import { addCalendarDays, detectBrowserTimeZone } from "@/lib/timezone";

function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AdminGroupOpportunityForm({
  subjects,
  currencies,
  defaultCurrency,
}: {
  subjects: { slug: string; name: string }[];
  currencies: { code: string; symbol: string }[];
  defaultCurrency: string;
}) {
  const router = useRouter();
  const [startsOn, setStartsOn] = useState(todayIso);
  const [endsOn, setEndsOn] = useState(todayIso);
  const [startTime, setStartTime] = useState("16:00");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [weekInterval, setWeekInterval] = useState(1);
  const [duration, setDuration] = useState(60);
  const [capacity, setCapacity] = useState(DEFAULT_GROUP_CLASS_CAPACITY);
  const [minStudents, setMinStudents] = useState(DEFAULT_GROUP_MIN_STUDENTS);
  const [studentPrice, setStudentPrice] = useState("0");
  const [teacherPayment, setTeacherPayment] = useState("");
  const [currencyCode, setCurrencyCode] = useState(defaultCurrency);
  const [visibleFrom, setVisibleFrom] = useState("");
  const [applicationDeadline, setApplicationDeadline] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
          await postJson("/api/v1/staff/group-class-opportunities", {
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
            startsOn,
            endsOn: endsOn && endsOn >= startsOn ? endsOn : startsOn,
            startTime,
            weekdays: weekdays.length ? weekdays : undefined,
            weekInterval,
            durationMinutes: duration,
            capacity,
            minStudents: resolveGroupMinStudents(minStudents, capacity),
            studentPriceMajor: Number(studentPrice),
            teacherPaymentMajor: Number(teacherPayment),
            currencyCode,
            visibleFrom: visibleFrom || undefined,
            applicationDeadline: applicationDeadline || undefined,
            timeZone: detectBrowserTimeZone() ?? undefined,
          });
          formEl.reset();
          setStudentPrice("0");
          setTeacherPayment("");
          setVisibleFrom("");
          setApplicationDeadline("");
          setMessage("Class opportunity posted. Teachers can apply until you close it or the deadline passes.");
          router.refresh();
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Could not post the class opportunity",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <h2 className="text-2xl font-extrabold text-brand">
        Post a group-class opportunity
      </h2>
      <p className="mt-2 text-sm text-muted">
        Teachers who offer this subject can apply and bid. Families do not see
        opportunities, and they never see teacher payment. Staff teacher
        selection comes after applications are in.
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
          <span className="mb-1 block text-sm font-bold text-brand">Class time</span>
          <input
            type="time"
            required
            className={fieldClass}
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">Lesson length</span>
          <select
            className={fieldClass}
            value={duration}
            onChange={(event) => setDuration(Number(event.target.value))}
          >
            {LESSON_DURATION_OPTIONS_MINUTES.map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatLessonDuration(minutes)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">
            Visible to teachers from (optional)
          </span>
          <input
            type="date"
            max={startsOn}
            className={fieldClass}
            value={visibleFrom}
            onChange={(event) => setVisibleFrom(event.target.value)}
          />
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">
            Teacher application deadline (optional)
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
            Leave empty to keep applications open until the first class.
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
            Leave empty to use the weekday of the start date. Up to{" "}
            {MAX_GROUP_CLASS_SESSIONS} sessions.
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
          <input name="minAge" type="number" min={3} max={99} className={fieldClass} />
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">
            Maximum age (optional)
          </span>
          <input name="maxAge" type="number" min={3} max={99} className={fieldClass} />
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
          <span className="mb-1 block text-sm font-bold text-brand">Minimum students</span>
          <input
            type="number"
            min={MIN_GROUP_CLASS_CAPACITY}
            max={capacity || MAX_GROUP_CLASS_CAPACITY}
            value={minStudents}
            required
            className={fieldClass}
            onChange={(event) => setMinStudents(Number(event.target.value))}
          />
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">Currency</span>
          <select
            className={fieldClass}
            value={currencyCode}
            onChange={(event) => setCurrencyCode(event.target.value)}
          >
            {currencies.map((item) => (
              <option key={item.code} value={item.code}>
                {item.code} · {item.symbol}
              </option>
            ))}
          </select>
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
            {estimatedSessions > 1
              ? `${estimatedSessions} sessions in this schedule.`
              : "What each student will pay after a teacher is selected."}
          </span>
          {estimatedSessions > MAX_GROUP_CLASS_SESSIONS ? (
            <span className="mt-2 block rounded-2xl bg-gold px-3 py-2 text-sm font-semibold text-brand">
              This range creates {estimatedSessions} sessions. Shorten the end
              date or choose fewer weekdays. The limit is{" "}
              {MAX_GROUP_CLASS_SESSIONS}.
            </span>
          ) : null}
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold text-brand">
            Listed teacher payment per session ({currencyCode})
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
            Teachers see this as the listed payment and can bid a different amount.
            Students never see it.
          </span>
        </label>
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
          !subjects.length ||
          estimatedSessions > MAX_GROUP_CLASS_SESSIONS
        }
      >
        {pending ? "Posting…" : "Post opportunity"}
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
