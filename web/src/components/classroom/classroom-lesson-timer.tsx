"use client";

import { useEffect, useState } from "react";
import { useI18n, useT } from "@/components/i18n/i18n-provider";
import {
  classroomTimerState,
  formatClassroomCountdown,
} from "@/lib/classroom";
import { detectBrowserTimeZone, formatClockInTimeZone } from "@/lib/timezone";

export function ClassroomLessonTimer({
  startsAt,
  endsAt,
}: {
  startsAt: string;
  endsAt: string;
}) {
  const t = useT();
  const { locale } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  const zone = detectBrowserTimeZone() ?? "UTC";
  const timer = classroomTimerState(startsAt, endsAt, now);
  const clock = formatClassroomCountdown(timer.remainingMs);
  const range = t("classroom.timer_range", {
    start: formatClockInTimeZone(startsAt, zone, locale),
    end: formatClockInTimeZone(endsAt, zone, locale),
  });

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const label =
    timer.phase === "upcoming"
      ? t("classroom.timer_starts", { time: clock })
      : timer.phase === "live"
        ? t("classroom.timer_left", { time: clock })
        : timer.phase === "overtime"
          ? t("classroom.timer_over", { time: clock })
          : t("classroom.timer_closed");

  const tone = timer.urgent
    ? "bg-rose text-brand"
    : timer.warn
      ? "bg-gold text-brand"
      : "bg-background text-brand";

  return (
    <div className="flex min-w-0 flex-col items-end gap-1">
      <p className="text-[0.65rem] font-extrabold uppercase tracking-wide text-muted">
        {t("classroom.timer")}
        <span className="mx-1 font-semibold normal-case text-muted">·</span>
        <span className="font-semibold normal-case">{range}</span>
      </p>
      <div
        className={`rounded-full px-3 py-1 text-xs font-extrabold tabular-nums ${tone}`}
        role="timer"
        aria-live="polite"
        aria-label={label}
      >
        {label}
      </div>
      {timer.phase === "live" ? (
        <div
          className="h-1.5 w-full min-w-[8rem] overflow-hidden rounded-full bg-line"
          aria-hidden
        >
          <div
            className="h-full rounded-full transition-[width] duration-1000 ease-linear"
            style={{
              width: `${Math.max(4, Math.round(timer.progress * 100))}%`,
              background: timer.urgent
                ? "var(--color-rose, #fecdd3)"
                : "var(--classroom-accent, #CB9F64)",
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
