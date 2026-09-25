"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass, getJson, postJson } from "@/lib/api";
import { MAX_RECURRING_WEEKS, PACKAGE_OPTIONS, formatLessonDuration, noticeDurationParts, type BookingView } from "@/lib/booking";
import { detectBrowserTimeZone, withTimeZoneQuery } from "@/lib/timezone";

type Slot = {
  startsAt: string;
  endsAt: string;
  label: string;
  teacherLabel: string | null;
  durationMinutes: number;
};

type SlotsResponse = {
  timezone: string;
  viewerTimeZone: string;
  format?: "one_to_one";
  durationMinutes: number;
  lessonDurationMinutes?: number;
  durationOptions?: number[];
  trialDurationMinutes?: number;
  trialPricePercent?: number;
  minNoticeMinutes: number;
  cancelNoticeMinutes: number;
  minCommitmentLessons: number;
  subjectSlugs: string[];
  slots: Slot[];
};

function bookingNoticeLabel(
  minutes: number,
  t: (key: "booking.notice_none" | "booking.notice_minute" | "booking.notice_minutes" | "booking.notice_hour" | "booking.notice_hours" | "booking.notice_day" | "booking.notice_days", vars?: Record<string, string | number>) => string,
) {
  const parts = noticeDurationParts(minutes);
  if (parts.unit === "none") {
    return t("booking.notice_none");
  }
  if (parts.unit === "days") {
    return parts.count === 1
      ? t("booking.notice_day")
      : t("booking.notice_days", { count: parts.count });
  }
  if (parts.unit === "hours") {
    return parts.count === 1
      ? t("booking.notice_hour")
      : t("booking.notice_hours", { count: parts.count });
  }
  return parts.count === 1
    ? t("booking.notice_minute")
    : t("booking.notice_minutes", { count: parts.count });
}

type BookingChild = {
  userId: string;
  displayName: string;
};

export function TeacherBookForm({
  teacherUserId,
  teacherName,
  subjects,
  hasRate,
  hourlyRate,
  viewer,
}: {
  teacherUserId: string;
  teacherName: string;
  subjects: { slug: string; name: string }[];
  hasRate: boolean;
  hourlyRate?: string | null;
  viewer: {
    roleKey: string;
    userId: string;
    children: BookingChild[];
    parentManaged: boolean;
  } | null;
}) {
  const t = useT();
  const [slots, setSlots] = useState<SlotsResponse | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [kind, setKind] = useState<"lesson" | "trial">("lesson");
  const [bookingMode, setBookingMode] = useState<"single" | "recurring" | "package">("single");
  const [packageSize, setPackageSize] = useState<number>(
    PACKAGE_OPTIONS[0].lessons,
  );
  const [startsAt, setStartsAt] = useState("");
  const [duration, setDuration] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState<BookingView[] | null>(null);
  const canBook =
    viewer?.roleKey === "parent" ||
    (viewer?.roleKey === "student" && !viewer.parentManaged);

  useEffect(() => {
    let cancelled = false;
    const timeZone = detectBrowserTimeZone();
    const params = duration
      ? `/api/v1/teachers/${teacherUserId}/slots?durationMinutes=${duration}`
      : `/api/v1/teachers/${teacherUserId}/slots`;
    void getJson<SlotsResponse>(withTimeZoneQuery(params, timeZone))
      .then((data) => {
        if (!cancelled) {
          setSlots(data);
          setDuration((current) => current ?? data.durationMinutes);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("booking.slots_failed"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [teacherUserId, duration, t]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Slot[]>();
    for (const slot of slots?.slots ?? []) {
      const day = new Intl.DateTimeFormat(undefined, {
        timeZone: slots?.viewerTimeZone,
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(new Date(slot.startsAt));
      const list = groups.get(day) ?? [];
      list.push(slot);
      groups.set(day, list);
    }
    return [...groups.entries()];
  }, [slots]);

  if (viewer?.roleKey === "teacher" && viewer.userId === teacherUserId) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-muted">{t("booking.own_profile")}</p>
        <ButtonLink href="/teach/availability" className="w-full">
          {t("booking.manage_hours")}
        </ButtonLink>
      </div>
    );
  }

  if (!hasRate) {
    return <p className="text-sm font-semibold text-muted">{t("booking.no_rate")}</p>;
  }

  if (!viewer) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-muted">{t("booking.sign_in")}</p>
        <ButtonLink href="/login" className="w-full">
          {t("nav.login")}
        </ButtonLink>
        <ButtonLink href="/register?role=parent" variant="secondary" className="w-full">
          {t("booking.register_parent")}
        </ButtonLink>
      </div>
    );
  }

  if (viewer.roleKey === "student" && viewer.parentManaged) {
    return <p className="text-sm font-semibold text-muted">{t("booking.managed_student")}</p>;
  }

  if (viewer.roleKey === "parent" && !viewer.children.length) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-muted">{t("booking.add_child_first")}</p>
        <ButtonLink href="/family/children/new" className="w-full">
          {t("family.add_child")}
        </ButtonLink>
      </div>
    );
  }

  if (!canBook) {
    return <p className="text-sm font-semibold text-muted">{t("booking.staff_view")}</p>;
  }

  const offered = subjects.filter(
    (subject) => !slots || slots.subjectSlugs.includes(subject.slug),
  );
  const minRecurringWeeks = Math.max(2, slots?.minCommitmentLessons ?? 2);
  const packageOptions = PACKAGE_OPTIONS.filter(
    (option) => option.lessons >= minRecurringWeeks,
  );
  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        if (!startsAt) {
          setError(t("booking.pick_slot"));
          return;
        }
        setPending(true);
        setError("");
        setMessage("");
        try {
          const created = await postJson<{ bookings: BookingView[] }>("/api/v1/bookings", {
            teacherUserId,
            studentUserId:
              viewer.roleKey === "parent"
                ? String(form.get("studentUserId") ?? "")
                : viewer.userId,
            subjectSlug: String(form.get("subjectSlug") ?? ""),
            startsAt,
            kind,
            bookingMode,
            packageSize: bookingMode === "package" ? packageSize : undefined,
            durationMinutes: duration ?? slots?.durationMinutes,
            weeks:
              bookingMode === "recurring" && kind !== "trial"
                ? Number(form.get("weeks") || minRecurringWeeks)
                : 1,
            timeZone: detectBrowserTimeZone() ?? undefined,
          });
          setConfirmed(created.bookings);
          setMessage(t("booking.success", { name: teacherName }));
          setStartsAt("");
          const timeZone = detectBrowserTimeZone();
          const params = duration
            ? `/api/v1/teachers/${teacherUserId}/slots?durationMinutes=${duration}`
            : `/api/v1/teachers/${teacherUserId}/slots`;
          setSlots(await getJson<SlotsResponse>(withTimeZoneQuery(params, timeZone)));
        } catch (err) {
          setError(err instanceof Error ? err.message : t("booking.failed"));
        } finally {
          setPending(false);
        }
      }}
    >
      <p className="text-sm font-semibold text-muted">
        {t("booking.format_note")}
      </p>
      <p className="rounded-2xl bg-mint/70 px-4 py-3 text-sm font-semibold text-brand">
        {t(
          bookingMode === "package"
            ? "booking.package_note"
            : bookingMode === "recurring"
              ? "booking.recurring_note"
              : "booking.single_note",
        )}
      </p>
      {kind === "lesson" && bookingMode !== "single" ? (
        <p className="text-sm font-semibold text-brand">
          {t("booking.commitment_effective", { count: minRecurringWeeks })}
        </p>
      ) : null}
      <p className="text-sm font-semibold text-muted">
        {t("booking.notice", {
          label: bookingNoticeLabel(slots?.minNoticeMinutes ?? 120, t),
        })}
      </p>
      {hourlyRate ? (
        <p className="text-sm text-muted">
          {kind === "trial"
            ? t("booking.trial_price", {
                percent: slots?.trialPricePercent ?? 50,
              })
            : t("booking.price_hourly", { price: hourlyRate })}
          {duration && kind !== "trial"
            ? ` ${t("booking.price_prorate", { minutes: duration })}`
            : ""}
        </p>
      ) : null}
      {slots && slots.timezone !== slots.viewerTimeZone ? (
        <p className="text-sm text-muted">
          {t("booking.timezone_converted", {
            zone: slots.viewerTimeZone,
            teacherZone: slots.timezone,
          })}
        </p>
      ) : slots ? (
        <p className="text-sm text-muted">
          {t("booking.timezone_note", { zone: slots.viewerTimeZone })}
        </p>
      ) : null}
      {viewer.roleKey === "parent" ? (
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">
            {t("booking.child")}
          </span>
          <select name="studentUserId" required className={fieldClass}>
            {viewer.children.map((child) => (
              <option key={child.userId} value={child.userId}>
                {child.displayName}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="block">
        <span className="mb-1 block text-sm font-bold text-brand">
          {t("booking.subject")}
        </span>
        <select name="subjectSlug" required className={fieldClass}>
          {offered.map((subject) => (
            <option key={subject.slug} value={subject.slug}>
              {subject.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-bold text-brand">{t("booking.kind")}</span>
        <select
          className={fieldClass}
          value={kind}
          onChange={(event) => {
            const next = event.target.value as "lesson" | "trial";
            setKind(next);
            if (next === "trial") setBookingMode("single");
            setDuration(
              next === "trial"
                ? slots?.trialDurationMinutes ?? 30
                : slots?.lessonDurationMinutes ?? 60,
            );
            setStartsAt("");
          }}
        >
          <option value="lesson">{t("booking.kind_lesson")}</option>
          <option value="trial">{t("booking.kind_trial")}</option>
        </select>
      </label>
      {kind === "lesson" ? (
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">
            {t("booking.mode")}
          </span>
          <select
            className={fieldClass}
            value={bookingMode}
            onChange={(event) => {
              const next = event.target.value as
                | "single"
                | "recurring"
                | "package";
              setBookingMode(next);
              if (next === "package" && packageOptions[0]) {
                setPackageSize(packageOptions[0].lessons);
              }
              setStartsAt("");
            }}
          >
            <option value="single">{t("booking.mode_single")}</option>
            <option value="recurring">{t("booking.mode_recurring")}</option>
            <option value="package">{t("booking.mode_package")}</option>
          </select>
        </label>
      ) : null}
      {kind === "trial" ? (
        <p className="rounded-2xl bg-gold/60 px-4 py-3 text-sm font-semibold text-brand">
          {t("booking.trial_note", {
            minutes: slots?.trialDurationMinutes ?? 30,
          })}
        </p>
      ) : (slots?.durationOptions ?? [30, 45, 60]).length ? (
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">
            {t("booking.duration")}
          </span>
          <select
            className={fieldClass}
            value={duration ?? slots?.durationMinutes ?? 30}
            onChange={(event) => {
              setDuration(Number(event.target.value));
              setStartsAt("");
            }}
          >
            {(slots?.durationOptions ?? [30, 45, 60]).map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatLessonDuration(minutes)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {kind === "lesson" && bookingMode === "recurring" ? (
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">
            {t("booking.weeks")}
          </span>
          <select
            name="weeks"
            className={fieldClass}
            key={minRecurringWeeks}
            defaultValue={minRecurringWeeks}
          >
            {Array.from(
              { length: MAX_RECURRING_WEEKS - minRecurringWeeks + 1 },
              (_, index) => minRecurringWeeks + index,
            ).map((week) => (
              <option key={week} value={week}>
                {t("booking.week_count", { count: week })}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {kind === "lesson" && bookingMode === "package" ? (
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">
            {t("booking.package_size")}
          </span>
          <select
            className={fieldClass}
            value={packageSize}
            onChange={(event) => {
              setPackageSize(Number(event.target.value) as typeof packageSize);
              setStartsAt("");
            }}
          >
            {packageOptions.map((option) => (
              <option key={option.lessons} value={option.lessons}>
                {t("booking.package_option", {
                  count: option.lessons,
                  discount: option.discountPercent,
                })}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div>
        <p className="mb-2 text-sm font-bold text-brand">{t("booking.pick_slot")}</p>
        {slots && !slots.slots.length ? (
          <p className="text-sm text-muted">{t("booking.no_slots")}</p>
        ) : null}
        <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {grouped.map(([day, daySlots]) => (
            <div key={day}>
              <p className="text-xs font-bold uppercase text-brand-soft">{day}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {daySlots.map((slot) => (
                  <button
                    key={slot.startsAt}
                    type="button"
                    onClick={() => setStartsAt(slot.startsAt)}
                    className={`min-h-11 rounded-full px-3 text-sm font-bold ${
                      startsAt === slot.startsAt
                        ? "bg-brand text-white"
                        : "bg-mint text-brand"
                    }`}
                  >
                    {new Intl.DateTimeFormat(undefined, {
                      timeZone: slots?.viewerTimeZone,
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(slot.startsAt))}
                    {slots && slots.timezone !== slots.viewerTimeZone ? (
                      <span className="mt-0.5 block text-[10px] font-semibold opacity-80">
                        {new Intl.DateTimeFormat(undefined, {
                          timeZone: slots.timezone,
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(slot.startsAt))}{" "}
                        {slots.timezone.split("/").pop()?.replaceAll("_", " ")}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={pending || !startsAt}>
        {pending ? t("booking.booking") : t("booking.book")}
      </Button>
      {viewer.roleKey === "parent" ? (
        <ButtonLink href="/family/bookings" variant="secondary" className="w-full">
          {t("booking.your_bookings")}
        </ButtonLink>
      ) : (
        <ButtonLink href="/learn/bookings" variant="secondary" className="w-full">
          {t("booking.your_bookings")}
        </ButtonLink>
      )}
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
      {confirmed?.length ? (
        <ul className="space-y-2 rounded-2xl bg-mint/70 px-4 py-3">
          {confirmed.map((row) => (
            <li key={row.id}>
              <p className="text-xs font-bold uppercase text-brand-soft">
                {row.formatLabel} ·{" "}
                {t(
                  row.bookingMode === "package"
                    ? "booking.mode_package"
                    : row.bookingMode === "recurring"
                      ? "booking.mode_recurring"
                      : "booking.mode_single",
                )}{" "}
                · {row.kindLabel}
              </p>
              <p className="font-extrabold text-brand">{row.whenLabel}</p>
              <p className="text-sm text-muted">
                {row.subjectName ?? row.subjectSlug}
                {` · ${row.durationMinutes} ${t("booking.minutes")}`}
                {row.amountFormatted ? ` · ${row.amountFormatted}` : ""}
                {row.packageTotalFormatted
                  ? ` · ${t("booking.package_total", {
                      price: row.packageTotalFormatted,
                    })}`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
