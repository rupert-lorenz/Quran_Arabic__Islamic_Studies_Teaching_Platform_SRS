"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/lib/api";
import {
  alignSingleWeekdayToStartDate,
  formatNoticeDuration,
  formatWeekdayList,
  sortedWeekdays,
  weekdayOptions,
  type AvailabilityWindowView,
  type TeacherAvailabilityState,
} from "@/lib/booking";
import { formatIsoDateLabel, isoDateDiffDays } from "@/lib/timezone";

type RecurringDraft = {
  weekdays: number[];
  startTime: string;
  endTime: string;
  startsOn: string;
  endsOn: string;
  weekInterval: number;
  note: string;
};

const workingHoursDraft: RecurringDraft = {
  weekdays: [1],
  startTime: "16:00",
  endTime: "20:00",
  startsOn: "",
  endsOn: "",
  weekInterval: 1,
  note: "",
};

const breakDraft: RecurringDraft = {
  weekdays: [5],
  startTime: "12:00",
  endTime: "13:00",
  startsOn: "",
  endsOn: "",
  weekInterval: 1,
  note: "",
};

export function TeacherAvailabilityForm({
  state,
  pending,
  onTimezone,
  onNotice,
  onCommitment,
  onAdd,
  onUpdate,
  onRemove,
  onRemoveGroup,
}: {
  state: TeacherAvailabilityState;
  pending: string;
  onTimezone: (timezone: string) => void;
  onNotice: (minNoticeMinutes: number | null) => void;
  onCommitment: (minCommitmentLessons: number | null) => void;
  onAdd: (body: Record<string, unknown>) => void;
  onUpdate: (id: string, body: Record<string, unknown>) => void;
  onRemove: (id: string) => void;
  onRemoveGroup: (id: string) => void;
}) {
  const extras = state.windows.filter((row) => row.kind === "extra");
  const blocks = state.windows.filter((row) => row.kind === "block");

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-xl font-extrabold text-brand">Teaching timezone</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Working hours are stored in this timezone. Families see the same
          instants converted to their own timezone.
        </p>
        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            onTimezone(String(form.get("timezone") ?? ""));
          }}
        >
          <label className="block flex-1">
            <span className="mb-1 block text-sm font-bold text-brand">Timezone</span>
            <select
              name="timezone"
              className={fieldClass}
              defaultValue={state.timezone}
              key={state.timezone}
            >
              {state.timezones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={Boolean(pending)}>
            {pending === "timezone" ? "Saving…" : "Save timezone"}
          </Button>
        </form>
      </section>

      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-xl font-extrabold text-brand">Minimum booking notice</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Families cannot book a time that starts sooner than this. The platform
          floor is {formatNoticeDuration(state.notice.platformMinutes)}. You can
          require more notice, but not less.
        </p>
        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const raw = String(form.get("minNoticeMinutes") ?? "platform");
            onNotice(raw === "platform" ? null : Number(raw));
          }}
        >
          <label className="block flex-1">
            <span className="mb-1 block text-sm font-bold text-brand">Notice</span>
            <select
              name="minNoticeMinutes"
              className={fieldClass}
              defaultValue={
                state.notice.teacherMinutes == null ||
                state.notice.teacherMinutes < state.notice.platformMinutes
                  ? "platform"
                  : String(state.notice.teacherMinutes)
              }
              key={`${state.notice.teacherMinutes ?? "platform"}-${state.notice.platformMinutes}`}
            >
              <option value="platform">
                Platform minimum · {formatNoticeDuration(state.notice.platformMinutes)}
              </option>
              {state.notice.options
                .filter((row) => row.minutes !== state.notice.platformMinutes)
                .map((row) => (
                  <option key={row.minutes} value={row.minutes}>
                    {row.label}
                  </option>
                ))}
            </select>
          </label>
          <Button type="submit" disabled={Boolean(pending)}>
            {pending === "notice" ? "Saving…" : "Save notice"}
          </Button>
        </form>
        <p className="mt-3 text-sm font-semibold text-brand">
          Families currently need {formatNoticeDuration(state.notice.effectiveMinutes)}.
        </p>
      </section>

      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-xl font-extrabold text-brand">Minimum commitment</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          This applies to recurring bookings and lesson packages. Single and
          trial bookings stay available. The platform floor is{" "}
          {state.commitment.platformLessons} lesson
          {state.commitment.platformLessons === 1 ? "" : "s"}.
        </p>
        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const raw = String(form.get("minCommitmentLessons") ?? "platform");
            onCommitment(raw === "platform" ? null : Number(raw));
          }}
        >
          <label className="block flex-1">
            <span className="mb-1 block text-sm font-bold text-brand">
              Minimum lessons
            </span>
            <select
              name="minCommitmentLessons"
              className={fieldClass}
              defaultValue={
                state.commitment.teacherLessons == null
                  ? "platform"
                  : state.commitment.teacherLessons
              }
              key={`${state.commitment.teacherLessons ?? "platform"}-${state.commitment.platformLessons}`}
            >
              <option value="platform">
                Platform minimum · {state.commitment.platformLessons}
              </option>
              {state.commitment.options
                .filter(
                  (lessons) => lessons !== state.commitment.platformLessons,
                )
                .map((lessons) => (
                  <option key={lessons} value={lessons}>
                    {lessons} lessons
                  </option>
                ))}
            </select>
          </label>
          <Button type="submit" disabled={Boolean(pending)}>
            {pending === "commitment" ? "Saving…" : "Save commitment"}
          </Button>
        </form>
        <p className="mt-3 text-sm font-semibold text-brand">
          Families currently commit to at least{" "}
          {state.commitment.effectiveLessons} lesson
          {state.commitment.effectiveLessons === 1 ? "" : "s"} for recurring
          bookings.
        </p>
      </section>

      <RepeatingScheduleForm
        kind="recurring"
        title="Working hours"
        description="Publish the weekly window when you teach. Choose several days, how often it repeats, and optional start and end dates. Families can book inside these hours after your minimum booking notice."
        emptyHint="No working hours yet. Add a weekly template so families can book you."
        addLabel="Add working hours"
        saveLabel="Save working hours"
        removeLabel="Remove schedule"
        notePlaceholder="Optional"
        listClassName="bg-mint"
        defaults={workingHoursDraft}
        windows={state.windows.filter((row) => row.kind === "recurring")}
        pending={pending}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onRemoveGroup={onRemoveGroup}
      />

      <RepeatingScheduleForm
        kind="break"
        title="Breaks"
        description="Close a repeating window inside your working hours, such as lunch or Jummah. Families cannot book during a break, even on days you otherwise teach."
        emptyHint="No breaks yet. Add a lunch, Jummah, or rest window that repeats each week."
        addLabel="Add break"
        saveLabel="Save break"
        removeLabel="Remove break"
        notePlaceholder="Lunch, Jummah…"
        listClassName="bg-slate-100"
        defaults={breakDraft}
        windows={state.windows.filter((row) => row.kind === "break")}
        pending={pending}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onRemoveGroup={onRemoveGroup}
      />

      <IndividualHoursForm
        windows={extras}
        pending={pending}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onRemove={onRemove}
      />

      <BlockedHolidaysForm
        windows={blocks}
        pending={pending}
        onAdd={onAdd}
        onUpdate={onUpdate}
        onRemoveGroup={onRemoveGroup}
      />
    </div>
  );
}

function RepeatingScheduleForm({
  kind,
  title,
  description,
  emptyHint,
  addLabel,
  saveLabel,
  removeLabel,
  notePlaceholder,
  listClassName,
  defaults,
  windows,
  pending,
  onAdd,
  onUpdate,
  onRemoveGroup,
}: {
  kind: "recurring" | "break";
  title: string;
  description: string;
  emptyHint: string;
  addLabel: string;
  saveLabel: string;
  removeLabel: string;
  notePlaceholder: string;
  listClassName: string;
  defaults: RecurringDraft;
  windows: AvailabilityWindowView[];
  pending: string;
  onAdd: (body: Record<string, unknown>) => void;
  onUpdate: (id: string, body: Record<string, unknown>) => void;
  onRemoveGroup: (id: string) => void;
}) {
  const schedules = useMemo(() => groupRecurringWindows(windows), [windows]);
  const [draft, setDraft] = useState<RecurringDraft>(defaults);
  const [editingId, setEditingId] = useState<string | null>(null);

  function toggleDay(value: number) {
    setDraft((current) => {
      const next = current.weekdays.includes(value)
        ? current.weekdays.filter((day) => day !== value)
        : [...current.weekdays, value];
      return { ...current, weekdays: sortedWeekdays(next) };
    });
  }

  function reset() {
    setDraft(defaults);
    setEditingId(null);
  }

  function save() {
    const weekdays = alignSingleWeekdayToStartDate(
      draft.weekdays,
      draft.startsOn || null,
    );
    const body = {
      weekdays,
      startTime: draft.startTime,
      endTime: draft.endTime,
      startsOn: draft.startsOn || null,
      endsOn: draft.endsOn || null,
      weekInterval: draft.weekInterval,
      note: draft.note.trim() || undefined,
    };
    if (editingId) {
      onUpdate(editingId, body);
    } else {
      onAdd({
        kind,
        ...body,
        startsOn: draft.startsOn || undefined,
        endsOn: draft.endsOn || undefined,
      });
    }
    reset();
  }

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="text-xl font-extrabold text-brand">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>

      <div className="mt-4">
        <p className="mb-2 text-sm font-bold text-brand">Days</p>
        <div className="flex flex-wrap gap-2">
          {weekdayOptions.map((day) => {
            const selected = draft.weekdays.includes(day.value);
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
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">From</span>
          <input
            value={draft.startTime}
            onChange={(event) => setDraft({ ...draft, startTime: event.target.value })}
            required
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">To</span>
          <input
            value={draft.endTime}
            onChange={(event) => setDraft({ ...draft, endTime: event.target.value })}
            required
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">Repeats</span>
          <select
            className={fieldClass}
            value={draft.weekInterval}
            onChange={(event) =>
              setDraft({ ...draft, weekInterval: Number(event.target.value) })
            }
          >
            <option value={1}>Every week</option>
            <option value={2}>Every 2 weeks</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">Note</span>
          <input
            className={fieldClass}
            value={draft.note}
            onChange={(event) => setDraft({ ...draft, note: event.target.value })}
            placeholder={notePlaceholder}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">
            Starts on{draft.weekInterval > 1 ? "" : " (optional)"}
          </span>
          <input
            type="date"
            className={fieldClass}
            value={draft.startsOn}
            required={draft.weekInterval > 1}
            onChange={(event) => {
              const startsOn = event.target.value;
              setDraft((current) => ({
                ...current,
                startsOn,
                weekdays: startsOn
                  ? alignSingleWeekdayToStartDate(current.weekdays, startsOn)
                  : current.weekdays,
              }));
            }}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">Ends on (optional)</span>
          <input
            type="date"
            className={fieldClass}
            value={draft.endsOn}
            onChange={(event) => setDraft({ ...draft, endsOn: event.target.value })}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={Boolean(pending) || draft.weekdays.length === 0}
          onClick={save}
        >
          {pending === (editingId ? `update:${editingId}` : kind)
            ? "Saving…"
            : editingId
              ? saveLabel
              : addLabel}
        </Button>
        {editingId ? (
          <Button
            type="button"
            variant="secondary"
            onClick={reset}
          >
            Cancel edit
          </Button>
        ) : null}
      </div>

      {schedules.length ? (
        <ul className="mt-4 space-y-2">
          {schedules.map((schedule) => (
            <li
              key={schedule.groupId}
              className={`flex flex-col gap-3 rounded-2xl px-4 py-3 lg:flex-row lg:items-center lg:justify-between ${listClassName}`}
            >
              <div>
                <p className="font-extrabold text-brand">
                  {schedule.daysLabel} · {schedule.startTime}–{schedule.endTime}
                </p>
                <p className="text-sm text-muted">
                  {schedule.weekInterval > 1
                    ? `Every ${schedule.weekInterval} weeks`
                    : "Every week"}
                  {schedule.startsOn
                    ? ` · from ${formatIsoDateLabel(schedule.startsOn)}`
                    : ""}
                  {schedule.endsOn
                    ? ` · until ${formatIsoDateLabel(schedule.endsOn)}`
                    : ""}
                  {schedule.note ? ` · ${schedule.note}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={Boolean(pending)}
                  onClick={() => {
                    setEditingId(schedule.id);
                    setDraft({
                      weekdays: alignSingleWeekdayToStartDate(
                        schedule.weekdays,
                        schedule.startsOn,
                      ),
                      startTime: schedule.startTime,
                      endTime: schedule.endTime,
                      startsOn: schedule.startsOn ?? "",
                      endsOn: schedule.endsOn ?? "",
                      weekInterval: schedule.weekInterval,
                      note: schedule.note ?? "",
                    });
                  }}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={Boolean(pending)}
                  onClick={() => onRemoveGroup(schedule.id)}
                >
                  {pending === `remove-group:${schedule.id}`
                    ? "Removing…"
                    : removeLabel}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm leading-6 text-muted">
          {emptyHint}
        </p>
      )}
    </section>
  );
}

function groupRecurringWindows(windows: AvailabilityWindowView[]) {
  const groups = new Map<string, AvailabilityWindowView[]>();
  for (const row of windows) {
    const list = groups.get(row.recurrenceGroupId) ?? [];
    list.push(row);
    groups.set(row.recurrenceGroupId, list);
  }
  return [...groups.values()].map((rows) => {
    const first = rows[0];
    const weekdays = alignSingleWeekdayToStartDate(
      rows.map((row) => row.weekday).filter((value): value is number => value != null),
      first.startsOn,
    );
    return {
      id: first.id,
      groupId: first.recurrenceGroupId,
      weekdays,
      daysLabel: formatWeekdayList(weekdays),
      startTime: first.startTime,
      endTime: first.endTime,
      startsOn: first.startsOn,
      endsOn: first.endsOn,
      weekInterval: first.weekInterval,
      note: first.note,
    };
  });
}

type IndividualDraft = {
  localDate: string;
  untilDate: string;
  startTime: string;
  endTime: string;
  replacesRecurring: boolean;
  note: string;
};

const emptyIndividualDraft: IndividualDraft = {
  localDate: "",
  untilDate: "",
  startTime: "09:00",
  endTime: "12:00",
  replacesRecurring: false,
  note: "",
};

function IndividualHoursForm({
  windows,
  pending,
  onAdd,
  onUpdate,
  onRemove,
}: {
  windows: AvailabilityWindowView[];
  pending: string;
  onAdd: (body: Record<string, unknown>) => void;
  onUpdate: (id: string, body: Record<string, unknown>) => void;
  onRemove: (id: string) => void;
}) {
  const [draft, setDraft] = useState<IndividualDraft>(emptyIndividualDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const rows = useMemo(
    () =>
      [...windows].sort((left, right) =>
        `${left.localDate}${left.startTime}`.localeCompare(`${right.localDate}${right.startTime}`),
      ),
    [windows],
  );

  function save() {
    if (editingId) {
      onUpdate(editingId, {
        localDate: draft.localDate,
        untilDate: draft.untilDate || null,
        startTime: draft.startTime,
        endTime: draft.endTime,
        replacesRecurring: draft.replacesRecurring,
        note: draft.note.trim() || null,
      });
    } else {
      onAdd({
        kind: "extra",
        localDate: draft.localDate,
        untilDate: draft.untilDate || undefined,
        startTime: draft.startTime,
        endTime: draft.endTime,
        replacesRecurring: draft.replacesRecurring,
        note: draft.note.trim() || undefined,
      });
    }
    setDraft(emptyIndividualDraft);
    setEditingId(null);
  }

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="text-xl font-extrabold text-brand">Individual hours</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Open hours on specific dates, or replace the weekly template for that
        weekday so the new hours repeat each week from the start date.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">Date</span>
          <input
            type="date"
            required
            className={fieldClass}
            value={draft.localDate}
            onChange={(event) => setDraft({ ...draft, localDate: event.target.value })}
          />
        </label>
        {editingId && !draft.replacesRecurring ? null : (
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">Until (optional)</span>
            <input
              type="date"
              className={fieldClass}
              value={draft.untilDate}
              onChange={(event) => setDraft({ ...draft, untilDate: event.target.value })}
            />
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">From</span>
          <input
            className={fieldClass}
            value={draft.startTime}
            onChange={(event) => setDraft({ ...draft, startTime: event.target.value })}
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">To</span>
          <input
            className={fieldClass}
            value={draft.endTime}
            onChange={(event) => setDraft({ ...draft, endTime: event.target.value })}
            required
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-bold text-brand">Note</span>
          <input
            className={fieldClass}
            value={draft.note}
            onChange={(event) => setDraft({ ...draft, note: event.target.value })}
            placeholder="Optional"
          />
        </label>
        <label className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
          <input
            type="checkbox"
            className="h-5 w-5 accent-brand"
            checked={draft.replacesRecurring}
            onChange={(event) =>
              setDraft({ ...draft, replacesRecurring: event.target.checked })
            }
          />
          <span className="text-sm font-semibold text-brand">
            Replace weekly hours for this weekday from these dates
          </span>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" disabled={Boolean(pending) || !draft.localDate} onClick={save}>
          {pending === (editingId ? `update:${editingId}` : "extra")
            ? "Saving…"
            : editingId
              ? "Save hours"
              : "Add individual hours"}
        </Button>
        {editingId ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setEditingId(null);
              setDraft(emptyIndividualDraft);
            }}
          >
            Cancel edit
          </Button>
        ) : null}
      </div>
      {rows.length ? (
        <ul className="mt-4 space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-3 rounded-2xl bg-gold/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-extrabold text-brand">
                  {row.replacesRecurring && row.weekdayLabel
                    ? `Every ${row.weekdayLabel}`
                    : row.localDate
                      ? formatIsoDateLabel(row.localDate)
                      : "Date"}{" "}
                  · {row.startTime}–{row.endTime}
                </p>
                <p className="text-sm text-muted">
                  {row.replacesRecurring
                    ? "Replaces weekly hours"
                    : "In addition to weekly hours"}
                  {row.startsOn
                    ? ` · from ${formatIsoDateLabel(row.startsOn)}`
                    : ""}
                  {row.endsOn ? ` · until ${formatIsoDateLabel(row.endsOn)}` : ""}
                  {row.note ? ` · ${row.note}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={Boolean(pending)}
                  onClick={() => {
                    setEditingId(row.id);
                    setDraft({
                      localDate: row.localDate ?? row.startsOn ?? "",
                      untilDate: row.endsOn ?? "",
                      startTime: row.startTime,
                      endTime: row.endTime,
                      replacesRecurring: row.replacesRecurring,
                      note: row.note ?? "",
                    });
                  }}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={Boolean(pending)}
                  onClick={() => onRemove(row.id)}
                >
                  {pending === `remove:${row.id}` ? "Removing…" : "Remove"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm leading-6 text-muted">
          No individual hours yet. Add a date when you can teach outside the weekly template.
        </p>
      )}
    </section>
  );
}

function formatDateSpan(dates: string[]) {
  const ordered = [...dates].sort();
  if (!ordered.length) {
    return "Dates";
  }
  if (ordered.length === 1) {
    return formatIsoDateLabel(ordered[0]);
  }
  const consecutive = ordered.every(
    (date, index) => index === 0 || isoDateDiffDays(ordered[index - 1], date) === 1,
  );
  if (consecutive) {
    return `${formatIsoDateLabel(ordered[0])} – ${formatIsoDateLabel(ordered[ordered.length - 1])}`;
  }
  return ordered.map((date) => formatIsoDateLabel(date)).join(", ");
}

type BlockDraft = {
  localDate: string;
  untilDate: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  note: string;
};

const emptyBlockDraft: BlockDraft = {
  localDate: "",
  untilDate: "",
  startTime: "09:00",
  endTime: "17:00",
  allDay: true,
  note: "",
};

function BlockedHolidaysForm({
  windows,
  pending,
  onAdd,
  onUpdate,
  onRemoveGroup,
}: {
  windows: AvailabilityWindowView[];
  pending: string;
  onAdd: (body: Record<string, unknown>) => void;
  onUpdate: (id: string, body: Record<string, unknown>) => void;
  onRemoveGroup: (id: string) => void;
}) {
  const holidays = useMemo(() => groupBlockedWindows(windows), [windows]);
  const [draft, setDraft] = useState<BlockDraft>(emptyBlockDraft);
  const [editingId, setEditingId] = useState<string | null>(null);

  function save() {
    const body = {
      localDate: draft.localDate,
      untilDate: draft.untilDate || draft.localDate,
      startTime: draft.allDay ? "00:00" : draft.startTime,
      endTime: draft.allDay ? "24:00" : draft.endTime,
      allDay: draft.allDay,
      note: draft.note.trim() || undefined,
    };
    if (editingId) {
      onUpdate(editingId, body);
    } else {
      onAdd({ kind: "block", ...body });
    }
    setDraft(emptyBlockDraft);
    setEditingId(null);
  }

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="text-xl font-extrabold text-brand">Blocked dates and holidays</h2>
      <p className="mt-2 text-sm leading-6 text-muted">
        Close a day, a part of a day, or a holiday range. Families cannot book
        inside blocked times, even if they sit on your weekly hours.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">From date</span>
          <input
            type="date"
            required
            className={fieldClass}
            value={draft.localDate}
            onChange={(event) => setDraft({ ...draft, localDate: event.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">Until date</span>
          <input
            type="date"
            className={fieldClass}
            value={draft.untilDate}
            onChange={(event) => setDraft({ ...draft, untilDate: event.target.value })}
          />
        </label>
        {draft.allDay ? null : (
          <>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">From</span>
              <input
                className={fieldClass}
                value={draft.startTime}
                onChange={(event) => setDraft({ ...draft, startTime: event.target.value })}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">To</span>
              <input
                className={fieldClass}
                value={draft.endTime}
                onChange={(event) => setDraft({ ...draft, endTime: event.target.value })}
                required
              />
            </label>
          </>
        )}
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-bold text-brand">Note</span>
          <input
            className={fieldClass}
            value={draft.note}
            onChange={(event) => setDraft({ ...draft, note: event.target.value })}
            placeholder="Eid, school holiday, leave…"
          />
        </label>
        <label className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
          <input
            type="checkbox"
            className="h-5 w-5 accent-brand"
            checked={draft.allDay}
            onChange={(event) => setDraft({ ...draft, allDay: event.target.checked })}
          />
          <span className="text-sm font-semibold text-brand">All day / holiday</span>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" disabled={Boolean(pending) || !draft.localDate} onClick={save}>
          {pending === (editingId ? `update:${editingId}` : "block")
            ? "Saving…"
            : editingId
              ? "Save block"
              : "Add blocked dates"}
        </Button>
        {editingId ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setEditingId(null);
              setDraft(emptyBlockDraft);
            }}
          >
            Cancel edit
          </Button>
        ) : null}
      </div>
      {holidays.length ? (
        <ul className="mt-4 space-y-2">
          {holidays.map((holiday) => (
            <li
              key={holiday.groupId}
              className="flex flex-col gap-3 rounded-2xl bg-rose px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-extrabold text-brand">{holiday.daysLabel}</p>
                <p className="text-sm text-muted">
                  {holiday.allDay ? "All day" : `${holiday.startTime}–${holiday.endTime}`}
                  {holiday.note ? ` · ${holiday.note}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={Boolean(pending)}
                  onClick={() => {
                    setEditingId(holiday.id);
                    setDraft({
                      localDate: holiday.dates[0] ?? "",
                      untilDate: holiday.dates[holiday.dates.length - 1] ?? "",
                      startTime: holiday.startTime,
                      endTime: holiday.endTime,
                      allDay: holiday.allDay,
                      note: holiday.note ?? "",
                    });
                  }}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={Boolean(pending)}
                  onClick={() => onRemoveGroup(holiday.id)}
                >
                  {pending === `remove-group:${holiday.id}` ? "Removing…" : "Remove"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm leading-6 text-muted">
          No blocked dates yet. Add a holiday or a closed window so families cannot book it.
        </p>
      )}
    </section>
  );
}

function groupBlockedWindows(windows: AvailabilityWindowView[]) {
  const groups = new Map<string, AvailabilityWindowView[]>();
  for (const row of windows) {
    const list = groups.get(row.recurrenceGroupId) ?? [];
    list.push(row);
    groups.set(row.recurrenceGroupId, list);
  }
  return [...groups.values()].map((rows) => {
    const first = rows[0];
    const dates = rows
      .map((row) => row.localDate)
      .filter((value): value is string => Boolean(value))
      .sort();
    return {
      id: first.id,
      groupId: first.recurrenceGroupId,
      dates,
      daysLabel: formatDateSpan(dates),
      startTime: first.startTime,
      endTime: first.endTime,
      allDay: first.allDay,
      note: first.note,
    };
  });
}
