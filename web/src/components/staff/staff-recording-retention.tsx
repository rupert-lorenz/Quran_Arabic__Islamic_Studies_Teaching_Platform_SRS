"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass, putJson } from "@/lib/api";

export function StaffRecordingRetention({
  initialDays,
}: {
  initialDays: number;
}) {
  const t = useT();
  const [days, setDays] = useState(String(initialDays));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  return (
    <form
      className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        setMessage("");
        try {
          const next = await putJson<{ retentionDays: number }>(
            "/api/v1/staff/recording-settings",
            { retentionDays: Number(days) },
          );
          setDays(String(next.retentionDays));
          setMessage(t("classroom.retention_saved"));
        } catch (err) {
          setError(err instanceof Error ? err.message : t("classroom.record_failed"));
        } finally {
          setPending(false);
        }
      }}
    >
      <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
        {t("classroom.retention_title")}
      </h2>
      <p className="mt-2 text-sm font-semibold text-muted">
        {t("classroom.retention_help")}
      </p>
      <label className="mt-4 block max-w-xs">
        <span className="mb-1 block text-sm font-bold text-brand">
          {t("classroom.retention_days")}
        </span>
        <input
          type="number"
          min={1}
          max={3650}
          className={fieldClass}
          value={days}
          onChange={(event) => setDays(event.target.value)}
        />
      </label>
      {error ? <p className="mt-3 text-sm font-semibold text-brand">{error}</p> : null}
      {message ? <p className="mt-3 text-sm font-semibold text-brand">{message}</p> : null}
      <Button type="submit" className="mt-4" disabled={pending}>
        {pending ? t("booking.saving") : t("common.save")}
      </Button>
    </form>
  );
}
