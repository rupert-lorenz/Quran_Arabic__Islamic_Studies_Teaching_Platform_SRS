"use client";

import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import {
  classroomJoinWindow,
  classroomOpenBeforeMs,
  classroomStatusAllowsJoin,
  classroomWaitParts,
  formatClassroomCountdown,
  type ClassroomLessonKind,
} from "@/lib/classroom";
import type { UiMessageKey } from "@/lib/i18n";

function formatStamp(iso: string, timeZone?: string | null) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

function formatWait(ms: number, t: (key: UiMessageKey, vars?: Record<string, string | number>) => string) {
  const parts = classroomWaitParts(ms);
  if (parts.days >= 1) {
    const days = t(
      parts.days === 1 ? "classroom.unit_day" : "classroom.unit_days",
      { count: parts.days },
    );
    if (!parts.hours) return days;
    const hours = t(
      parts.hours === 1 ? "classroom.unit_hour" : "classroom.unit_hours",
      { count: parts.hours },
    );
    return `${days} ${hours}`;
  }
  return formatClassroomCountdown(ms);
}

function ClockNote({
  iso,
  timeZone,
  clockKey,
}: {
  iso: string;
  timeZone?: string | null;
  clockKey: "classroom.opens_clock" | "classroom.begins_clock";
}) {
  const t = useT();
  const labelled = formatStamp(iso, timeZone);
  const local = formatStamp(iso);
  if (!labelled) return null;
  return (
    <p className="mt-1 text-sm font-semibold leading-6 text-muted">
      {t(clockKey, { time: labelled })}
      {local && local !== labelled
        ? ` · ${t("classroom.opens_local", { time: local })}`
        : ""}
    </p>
  );
}

function WaitRow({
  labelKey,
  remainingMs,
  iso,
  timeZone,
  clockKey,
}: {
  labelKey: "classroom.opens_label" | "classroom.begins_label";
  remainingMs: number;
  iso: string;
  timeZone?: string | null;
  clockKey: "classroom.opens_clock" | "classroom.begins_clock";
}) {
  const t = useT();
  const wait = formatWait(remainingMs, t);
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-brand-soft">
        {t(labelKey)}
      </p>
      <p
        className="font-heading mt-1 text-2xl font-bold tabular-nums tracking-tight text-brand"
        role="timer"
        aria-live="polite"
        aria-label={`${t(labelKey)} ${wait}`}
      >
        {wait}
      </p>
      <ClockNote iso={iso} timeZone={timeZone} clockKey={clockKey} />
    </div>
  );
}

export function ClassroomJoinButton({
  href,
  joinable,
  startsAt,
  endsAt,
  status = "published",
  kind = "group",
  role,
  timeZone,
  allowed = true,
  className = "",
}: {
  href?: string | null;
  joinable?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  status?: string;
  kind?: ClassroomLessonKind;
  role?: string | null;
  timeZone?: string | null;
  allowed?: boolean;
  className?: string;
}) {
  const t = useT();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!allowed) {
    return null;
  }

  const start = startsAt ? new Date(startsAt) : null;
  const end = endsAt ? new Date(endsAt) : null;
  const joinWindow =
    start && !Number.isNaN(start.getTime())
      ? classroomJoinWindow(
          start,
          end && !Number.isNaN(end.getTime()) ? end : start,
          now,
          classroomOpenBeforeMs(role),
        )
      : null;
  const liveJoinable =
    Boolean(href) &&
    classroomStatusAllowsJoin(kind, status) &&
    Boolean(joinWindow?.joinable || joinable);
  const beforeStart = Boolean(start && now < start.getTime());
  const showOpenWait = Boolean(joinWindow?.upcoming);
  const showStartWait = Boolean(joinWindow && beforeStart && !joinWindow.ended);

  if (!joinWindow) {
    if (liveJoinable && href) {
      return (
        <ButtonLink href={href} className={className}>
          {t("classroom.join")}
        </ButtonLink>
      );
    }
    return null;
  }

  if (joinWindow.ended) {
    return (
      <p className={`text-sm font-semibold leading-6 text-muted ${className}`.trim()}>
        {t("classroom.ended")}
      </p>
    );
  }

  if (!showOpenWait && !showStartWait && liveJoinable && href) {
    return (
      <ButtonLink href={href} className={className}>
        {t("classroom.join")}
      </ButtonLink>
    );
  }

  if (!showOpenWait && !showStartWait && !liveJoinable) {
    return (
      <p className={`text-sm font-semibold leading-6 text-muted ${className}`.trim()}>
        {t("classroom.closed")}
      </p>
    );
  }

  return (
    <div className={`min-w-0 space-y-3 ${className}`.trim()}>
      {showOpenWait ? (
        <WaitRow
          labelKey="classroom.opens_label"
          remainingMs={joinWindow.opensAt.getTime() - now}
          iso={joinWindow.opensAt.toISOString()}
          timeZone={timeZone}
          clockKey="classroom.opens_clock"
        />
      ) : null}
      {showStartWait && start ? (
        <WaitRow
          labelKey="classroom.begins_label"
          remainingMs={start.getTime() - now}
          iso={start.toISOString()}
          timeZone={timeZone}
          clockKey="classroom.begins_clock"
        />
      ) : null}
      {liveJoinable && href ? (
        <ButtonLink href={href}>{t("classroom.join")}</ButtonLink>
      ) : null}
    </div>
  );
}
