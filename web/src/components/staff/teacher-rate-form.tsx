"use client";

import { useState } from "react";
import { patchJson } from "@/lib/api";
import { TeacherRateLivePreview } from "@/components/teachers/teacher-rate-live-preview";
import type { TeacherRateView } from "@/lib/teacher-rate-display";

type TeacherRateTarget = {
  userId: string;
  rate: TeacherRateView | null;
  rateLimits: {
    minFormatted: string;
    maxFormatted: string;
    commissionPercent: number;
    lessonDurationMinutes: number;
    defaultCurrencyCode?: string;
    currencies: { code: string; name: string; symbol: string; decimalPlaces: number }[];
    conflict?: boolean;
    sources?: { label: string; appliesMin: boolean; appliesMax: boolean }[];
  };
};

export function TeacherRateForm<T extends TeacherRateTarget>({
  application,
  onUpdated,
}: {
  application: T;
  onUpdated: (next: T) => void;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className="mt-6 rounded-[2rem] border border-line bg-surface p-5">
      <h3 className="text-lg font-extrabold text-brand">Lesson rate</h3>
      <p className="mt-1 text-sm text-muted">
        Allowed range {application.rateLimits.minFormatted}–
        {application.rateLimits.maxFormatted}
        {application.rateLimits.sources?.length
          ? ` · ${application.rateLimits.sources.map((item) => item.label).join(", ")}`
          : ""}
        . The split updates as you type.
      </p>
      {error ? (
        <p className="mt-3 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
      <TeacherRateLivePreview
        key={application.rate?.formatted ?? "no-rate"}
        initialAmount={application.rate?.amount ?? ""}
        initialCurrencyCode={
          application.rate?.currencyCode ??
          application.rateLimits.defaultCurrencyCode ??
          application.rateLimits.currencies[0]?.code ??
          "GBP"
        }
        currencies={application.rateLimits.currencies}
        commissionPercent={application.rateLimits.commissionPercent}
        durationMinutes={application.rateLimits.lessonDurationMinutes}
        pending={pending}
        onSubmit={async (input) => {
          setPending(true);
          setError("");
          try {
            const next = await patchJson<{ rate: TeacherRateView }>(
              `/api/v1/staff/teachers/${application.userId}/rate`,
              input,
            );
            onUpdated({ ...application, rate: next.rate });
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save rate");
          } finally {
            setPending(false);
          }
        }}
      />
    </div>
  );
}
