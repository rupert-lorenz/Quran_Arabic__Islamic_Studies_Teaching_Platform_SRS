"use client";

import { useState } from "react";
import { useT } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { fieldClass, getJson, postJson } from "@/lib/api";

type Report = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
};

export function ReportConcern({ initial }: { initial: Report[] }) {
  const t = useT();
  const [reports, setReports] = useState(initial);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
        {t("safe.report.title")}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t("safe.report.help")}</p>
      <form
        className="mt-4 space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError("");
          setMessage("");
          try {
            await postJson("/api/v1/safeguarding/reports", { title, severity, summary });
            const next = await getJson<{ reports: Report[] }>("/api/v1/safeguarding/reports");
            setReports(next.reports);
            setTitle("");
            setSummary("");
            setSeverity("medium");
            setMessage(t("safe.report.sent"));
          } catch (err) {
            setError(err instanceof Error ? err.message : t("safe.report.failed"));
          } finally {
            setPending(false);
          }
        }}
      >
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">{t("safe.report.concern")}</span>
          <input
            className={fieldClass}
            value={title}
            required
            minLength={3}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">{t("safe.report.severity")}</span>
          <select
            className={fieldClass}
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
          >
            <option value="low">{t("safe.report.low")}</option>
            <option value="medium">{t("safe.report.medium")}</option>
            <option value="high">{t("safe.report.high")}</option>
            <option value="critical">{t("safe.report.critical")}</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">{t("safe.report.summary")}</span>
          <textarea
            className={fieldClass}
            value={summary}
            required
            minLength={10}
            maxLength={800}
            rows={4}
            onChange={(event) => setSummary(event.target.value)}
          />
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? t("safe.report.sending") : t("safe.report.send")}
        </Button>
        {message ? <p className="text-sm font-semibold text-brand">{message}</p> : null}
        {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
      </form>
      {reports.length ? (
        <ul className="mt-6 space-y-2">
          {reports.map((report) => (
            <li key={report.id} className="rounded-2xl border border-line px-4 py-3 text-sm">
              <p className="font-bold text-brand">{report.title}</p>
              <p className="mt-1 text-muted">
                {report.status} · {report.createdAt.slice(0, 10)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">{t("safe.report.empty")}</p>
      )}
    </section>
  );
}
