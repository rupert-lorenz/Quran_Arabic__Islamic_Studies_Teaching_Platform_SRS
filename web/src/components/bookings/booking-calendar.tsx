"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, getJson, postJson } from "@/lib/api";
import { useT } from "@/components/i18n/i18n-provider";
import { TimezoneSwitcher } from "@/components/i18n/timezone-switcher";
import type {
  BookingChangeRecordView,
  BookingView,
  BookingWorkspaceView,
  LessonCalendarState,
} from "@/lib/booking";
import { LessonWeekCalendar } from "@/components/bookings/lesson-week-calendar";
import { ClassroomJoinButton } from "@/components/classroom/classroom-join-button";
import { withTimeZoneQuery } from "@/lib/timezone";

type Slot = {
  startsAt: string;
  endsAt: string;
  label: string;
  teacherLabel?: string | null;
  durationMinutes: number;
};

type SlotsResponse = {
  timezone: string;
  viewerTimeZone: string;
  slots: Slot[];
};

export function BookingCalendar({
  initial,
  calendar: initialCalendar,
  role,
}: {
  initial: BookingWorkspaceView;
  calendar?: LessonCalendarState;
  role: "teacher" | "parent" | "student" | "staff";
}) {
  const t = useT();
  const [state, setState] = useState(initial);
  const [week, setWeek] = useState(initialCalendar ?? null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState("");
  const [now] = useState(() => Date.now());
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [cancelReasons, setCancelReasons] = useState<Record<string, string>>({});
  const [slots, setSlots] = useState<Slot[]>([]);
  const canComplete = role === "teacher" || role === "staff";
  const providerCancellation = role === "teacher" || role === "staff";
  const noticeMs = (state.policy?.cancelNoticeMinutes ?? 1440) * 60_000;

  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "");
    if (!id) {
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const upcoming = useMemo(
    () => state.bookings.filter((row) => new Date(row.startsAt).getTime() >= now - 12 * 60 * 60 * 1000),
    [now, state.bookings],
  );
  const past = useMemo(
    () => state.bookings.filter((row) => new Date(row.startsAt).getTime() < now - 12 * 60 * 60 * 1000),
    [now, state.bookings],
  );
  const convertedZone = [...upcoming, ...past].find((row) => row.teacherWhenLabel)?.teacherTimezone;

  async function loadWeek(from: string) {
    setPending(`week:${from}`);
    setError("");
    try {
      const next = await getJson<LessonCalendarState>(
        withTimeZoneQuery(`/api/v1/bookings/calendar?from=${from}`),
      );
      setWeek(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("booking.update_failed"));
    } finally {
      setPending("");
    }
  }

  async function mutate(id: string, path: string, body: unknown, label: string) {
    setPending(label);
    setError("");
    setMessage("");
    try {
      const next = await postJson<BookingWorkspaceView>(
        `/api/v1/bookings/${id}/${path}`,
        body,
      );
      setState({ ...next, policy: state.policy });
      setRescheduleId(null);
      setRescheduleReason("");
      setSlots([]);
      if (week) {
        const refreshed = await getJson<LessonCalendarState>(
          withTimeZoneQuery(`/api/v1/bookings/calendar?from=${week.weekStart}`),
        );
        setWeek(refreshed);
      }
      setMessage(t("booking.updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("booking.update_failed"));
    } finally {
      setPending("");
    }
  }

  async function openReschedule(row: BookingView) {
    setPending(`slots:${row.id}`);
    setError("");
    try {
      const data = await getJson<SlotsResponse>(
        withTimeZoneQuery(
          `/api/v1/teachers/${row.teacherUserId}/slots?durationMinutes=${row.durationMinutes}`,
        ),
      );
      setSlots(data.slots);
      setRescheduleId(row.id);
      setRescheduleReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("booking.update_failed"));
    } finally {
      setPending("");
    }
  }

  function financialActionLabel(action: string) {
    if (action === "credit") return t("booking.finance_action_credit");
    if (action === "refund") return t("booking.finance_action_refund");
    if (action === "forfeit") return t("booking.finance_action_forfeit");
    return t("booking.finance_action_none");
  }

  function renderRow(row: BookingView) {
    const confirmed = row.status === "confirmed";
    const until = new Date(row.startsAt).getTime() - now;
    const familyLocked = role === "parent" || role === "student" ? until < noticeMs : false;
    const started = new Date(row.startsAt).getTime() <= now;
    const ended = new Date(row.endsAt).getTime() <= now;
    const cancellationPolicyKey = providerCancellation
      ? "booking.cancel_provider_policy"
      : row.amountMinor === 0
        ? "booking.cancel_free_policy"
      : familyLocked
        ? "booking.cancel_late_policy"
        : "booking.cancel_early_policy";

    return (
      <li
        key={row.id}
        id={`booking-${row.id}`}
        className="scroll-mt-24 rounded-[1.5rem] border border-line bg-background px-4 py-4"
      >
        <p className="text-xs font-bold uppercase text-brand-soft">
          {row.formatLabel} ·{" "}
          {t(
            row.bookingMode === "package"
              ? "booking.mode_package"
              : row.bookingMode === "recurring"
                ? "booking.mode_recurring"
                : "booking.mode_single",
          )} ·{" "}
          {row.statusLabel}
          {row.kind === "trial" ? ` · ${row.kindLabel}` : ""}
          {row.seriesTotal
            ? ` · ${t("booking.series", { index: row.seriesIndex ?? 1, total: row.seriesTotal })}`
            : ""}
        </p>
        {row.cancelFinancialAction ? (
          <p className="mt-2 rounded-xl bg-gold/60 px-3 py-2 text-sm font-semibold text-brand">
            {financialActionLabel(row.cancelFinancialAction)}
            {row.cancelFinancialStatus
              ? ` · ${row.cancelFinancialStatus.replaceAll("_", " ")}`
              : ""}
          </p>
        ) : null}
        <p className="mt-1 text-lg font-extrabold text-brand">{row.whenLabel}</p>
        {row.teacherWhenLabel ? (
          <p className="text-sm font-semibold text-muted">
            {t("booking.teacher_time", {
              time: row.teacherWhenLabel,
              zone: row.teacherTimezone,
            })}
          </p>
        ) : null}
        <p className="mt-1 text-sm font-semibold text-brand">
          {role === "teacher" || role === "staff"
            ? t("booking.with_student", { name: row.studentName })
            : t("booking.with_teacher", { name: row.teacherName })}
          {row.subjectName ? ` · ${row.subjectName}` : ""}
        </p>
        <p className="mt-1 text-sm text-muted">
          {row.durationMinutes} {t("booking.minutes")}
          {row.amountFormatted ? ` · ${row.amountFormatted}` : ""}
          {row.listedPriceFormatted
            ? ` · ${t("card.listed_as", { price: row.listedPriceFormatted })}`
            : ""}
          {row.packageTotalFormatted
            ? ` · ${t("booking.package_total", {
                price: row.packageTotalFormatted,
              })}`
            : ""}
          {row.packageListedTotalFormatted
            ? ` · ${t("card.listed_as", { price: row.packageListedTotalFormatted })}`
            : ""}
          {row.packageDiscountPercent
            ? ` · ${t("booking.package_discount", {
                percent: row.packageDiscountPercent,
              })}`
            : ""}
          {row.cancelOutcomeLabel ? ` · ${row.cancelOutcomeLabel}` : ""}
        </p>
        {confirmed ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <ClassroomJoinButton
              className="w-full"
              href={row.classroomHref}
              joinable={row.classroomJoinable}
              startsAt={row.startsAt}
              endsAt={row.endsAt}
              status={row.status}
              kind="booking"
              role={role}
              timeZone={row.timezone}
            />
            {!started ? (
              <>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (window.confirm(t(cancellationPolicyKey))) {
                  void mutate(
                    row.id,
                    "cancel",
                    {
                      reason: cancelReasons[row.id]?.trim() || undefined,
                    },
                    `cancel:${row.id}`,
                  );
                }
              }}
              className="flex min-w-[16rem] flex-1 flex-col gap-2"
            >
              <p className="text-xs font-semibold text-muted">
                {t(cancellationPolicyKey)}
              </p>
              <input
                name="reason"
                className={fieldClass}
                placeholder={t("booking.reason_placeholder")}
                value={cancelReasons[row.id] ?? ""}
                onChange={(event) =>
                  setCancelReasons((current) => ({
                    ...current,
                    [row.id]: event.target.value,
                  }))
                }
                required={providerCancellation}
                maxLength={500}
              />
              <Button type="submit" variant="secondary" disabled={Boolean(pending)}>
                {pending === `cancel:${row.id}` ? t("booking.cancelling") : t("booking.cancel")}
              </Button>
            </form>
            {row.seriesId ? (
              <Button
                type="button"
                variant="secondary"
                disabled={Boolean(pending)}
                onClick={() => {
                  if (
                    providerCancellation &&
                    !cancelReasons[row.id]?.trim()
                  ) {
                    setError(t("booking.cancel_reason_required"));
                    return;
                  }
                  if (
                    window.confirm(
                      `${t("booking.cancel_series_confirm")}\n\n${t(cancellationPolicyKey)}`,
                    )
                  ) {
                    void mutate(
                      row.id,
                      "series/cancel",
                      {
                        reason: cancelReasons[row.id]?.trim() || undefined,
                      },
                      `series:${row.id}`,
                    );
                  }
                }}
              >
                {pending === `series:${row.id}`
                  ? t("booking.cancelling")
                  : t("booking.cancel_series")}
              </Button>
            ) : null}
            {!familyLocked ? (
              <Button
                type="button"
                variant="secondary"
                disabled={Boolean(pending)}
                onClick={() => void openReschedule(row)}
              >
                {pending === `slots:${row.id}`
                  ? t("booking.loading_slots")
                  : t("booking.reschedule")}
              </Button>
            ) : (
              <p className="text-sm font-semibold text-muted">{t("booking.notice_lock")}</p>
            )}
              </>
            ) : null}
            {canComplete && ended ? (
              <>
                <Button
                  type="button"
                  disabled={Boolean(pending)}
                  onClick={() => void mutate(row.id, "complete", { status: "completed" }, `done:${row.id}`)}
                >
                  {pending === `done:${row.id}` ? t("booking.saving") : t("booking.complete")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={Boolean(pending)}
                  onClick={() => void mutate(row.id, "complete", { status: "no_show" }, `miss:${row.id}`)}
                >
                  {pending === `miss:${row.id}` ? t("booking.saving") : t("booking.no_show")}
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
        {rescheduleId === row.id ? (
          <div className="mt-4 rounded-2xl bg-mint/70 p-3">
            <p className="text-sm font-bold text-brand">{t("booking.pick_slot")}</p>
            <p className="mt-1 text-sm text-muted">
              {t("booking.reschedule_restrictions")}
            </p>
            <input
              className={`${fieldClass} mt-3`}
              value={rescheduleReason}
              onChange={(event) => setRescheduleReason(event.target.value)}
              placeholder={t("booking.reason_placeholder")}
              maxLength={500}
            />
            {slots.length ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {slots.slice(0, 24).map((slot) => (
                  <div
                    key={slot.startsAt}
                    className="rounded-xl border border-line bg-surface p-3"
                  >
                    <p className="text-sm font-bold text-brand">
                      {slot.label}
                      {slot.teacherLabel ? ` · ${slot.teacherLabel}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={Boolean(pending)}
                        onClick={() =>
                          void mutate(
                            row.id,
                            "reschedule",
                            {
                              startsAt: slot.startsAt,
                              reason: rescheduleReason.trim() || undefined,
                            },
                            `move:${row.id}`,
                          )
                        }
                      >
                        {t("booking.move_one")}
                      </Button>
                      {row.seriesId ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={Boolean(pending)}
                          onClick={() => {
                            if (
                              window.confirm(
                                t("booking.reschedule_series_confirm"),
                              )
                            ) {
                              void mutate(
                                row.id,
                                "series/reschedule",
                                {
                                  startsAt: slot.startsAt,
                                  reason:
                                    rescheduleReason.trim() || undefined,
                                },
                                `move-series:${row.id}`,
                              );
                            }
                          }}
                        >
                          {t("booking.move_series")}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted">{t("booking.no_slots")}</p>
            )}
          </div>
        ) : null}
      </li>
    );
  }

  function renderChangeRecord(record: BookingChangeRecordView) {
    return (
      <li
        key={record.id}
        className="rounded-2xl border border-line bg-background p-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="font-extrabold text-brand">
            {t(
              record.kind === "cancelled"
                ? "booking.record_cancelled"
                : "booking.record_rescheduled",
            )}
          </p>
          <p className="text-xs font-semibold text-muted">
            {record.occurredLabel}
          </p>
        </div>
        <p className="mt-1 text-sm font-semibold text-brand">
          {t("booking.record_actor", {
            name: record.actorName,
            role: record.actorRole,
          })}
        </p>
        <p className="mt-1 text-sm text-muted">
          {record.teacherName} · {record.studentName}
        </p>
        {record.fromLabel ? (
          <p className="mt-2 text-sm text-muted">
            {record.fromLabel}
            {record.toLabel ? ` → ${record.toLabel}` : ""}
          </p>
        ) : null}
        {record.reason ? (
          <p className="mt-2 text-sm text-muted">
            {t("booking.record_reason", { reason: record.reason })}
          </p>
        ) : null}
        {record.outcomeLabel ? (
          <p className="mt-2 text-sm font-semibold text-brand">
            {record.outcomeLabel}
          </p>
        ) : null}
        {record.financialAction ? (
          <p className="mt-2 rounded-xl bg-gold/60 px-3 py-2 text-sm font-semibold text-brand">
            {financialActionLabel(record.financialAction)}
            {record.financialStatus
              ? ` · ${record.financialStatus.replaceAll("_", " ")}`
              : ""}
          </p>
        ) : null}
        <a
          href={`#booking-${record.bookingId}`}
          className="mt-2 inline-block text-sm font-bold text-brand underline"
        >
          {t("booking.record_open_lesson")}
        </a>
      </li>
    );
  }

  return (
    <div className="space-y-6">
      {week ? (
        <LessonWeekCalendar
          calendar={week}
          pending={pending}
          onWeekChange={(from) => void loadWeek(from)}
        />
      ) : null}
      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-xl font-extrabold text-brand">{t("booking.upcoming")}</h2>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            {convertedZone
              ? t("booking.timezone_converted", {
                  zone: state.timeZone,
                  teacherZone: convertedZone,
                })
              : t("booking.timezone_note", { zone: state.timeZone })}
          </p>
          {state.timezones?.length ? (
            <TimezoneSwitcher
              timezones={state.timezones}
              current={state.timeZone}
              label={t("timezone.label")}
              persist={role !== "teacher"}
              compact
            />
          ) : null}
        </div>
        {upcoming.length ? (
          <ul className="mt-4 space-y-3">{upcoming.map(renderRow)}</ul>
        ) : (
          <p className="mt-4 text-sm leading-6 text-muted">{t("booking.empty")}</p>
        )}
      </section>
      {past.length ? (
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h2 className="text-xl font-extrabold text-brand">{t("booking.past")}</h2>
          <ul className="mt-4 space-y-3">{past.map(renderRow)}</ul>
        </section>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h2 className="text-xl font-extrabold text-brand">
            {t("booking.teacher_change_records")}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {t("booking.teacher_change_records_note")}
          </p>
          {state.changeRecords?.teacher.length ? (
            <ul className="mt-4 space-y-3">
              {state.changeRecords.teacher.map(renderChangeRecord)}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">
              {t("booking.no_change_records")}
            </p>
          )}
        </section>
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h2 className="text-xl font-extrabold text-brand">
            {t("booking.student_change_records")}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {t("booking.student_change_records_note")}
          </p>
          {state.changeRecords?.student.length ? (
            <ul className="mt-4 space-y-3">
              {state.changeRecords.student.map(renderChangeRecord)}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">
              {t("booking.no_change_records")}
            </p>
          )}
        </section>
      </div>
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
