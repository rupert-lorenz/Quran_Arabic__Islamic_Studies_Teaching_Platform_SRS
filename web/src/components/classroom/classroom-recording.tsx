"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/i18n/i18n-provider";
import { formatClassroomRecordingTime } from "@/lib/classroom-recording";

export function ClassroomRecordingClock({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const started = Date.parse(startedAt);
  const seconds = Number.isFinite(started) ? (now - started) / 1000 : 0;
  return <span>{formatClassroomRecordingTime(seconds)}</span>;
}

export function ClassroomRecordingNotice({
  live,
  saving,
}: {
  live: boolean;
  saving?: boolean;
}) {
  const t = useT();
  if (saving) {
    return <p className="mt-3 text-xs font-semibold text-brand">{t("classroom.recording_saving")}</p>;
  }
  if (!live) return null;
  return <p className="mt-3 text-xs font-semibold text-brand">{t("classroom.recording_live")}</p>;
}
