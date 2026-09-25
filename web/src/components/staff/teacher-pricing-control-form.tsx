"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteJson, fieldClass, patchJson } from "@/lib/api";

type PricingTarget = {
  userId: string;
  rateLimits: {
    minFormatted: string;
    maxFormatted: string;
    conflict?: boolean;
    sources?: { label: string; appliesMin: boolean; appliesMax: boolean }[];
    teacherControl?: { minAmount: string; maxAmount: string } | null;
  };
};

export function TeacherPricingControlForm<T extends PricingTarget>({
  application,
  onUpdated,
}: {
  application: T;
  onUpdated: (next: T) => void;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const control = application.rateLimits.teacherControl;

  return (
    <form
      key={`${control?.minAmount ?? ""}-${control?.maxAmount ?? ""}`}
      className="mt-6 rounded-[2rem] border border-line bg-surface p-5"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setError("");
        try {
          onUpdated(
            await patchJson<T>(`/api/v1/staff/teachers/${application.userId}/pricing`, {
              minAmount: String(form.get("minAmount") ?? ""),
              maxAmount: String(form.get("maxAmount") ?? ""),
            }),
          );
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Could not save teacher pricing",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <h3 className="text-lg font-extrabold text-brand">Teacher-specific range</h3>
      <p className="mt-1 text-sm text-muted">
        Leave a field empty to inherit. A value here replaces the country/subject
        band for this teacher only.
      </p>
      {application.rateLimits.sources?.length ? (
        <ul className="mt-3 text-xs font-semibold text-brand-soft">
          {application.rateLimits.sources.map((source) => (
            <li key={`${source.label}-${source.appliesMin}-${source.appliesMax}`}>
              {source.label}
              {source.appliesMin ? " · min" : ""}
              {source.appliesMax ? " · max" : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {application.rateLimits.conflict ? (
        <p className="mt-3 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          These controls currently conflict. Widen one of the ranges.
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">
            Minimum override
          </span>
          <input
            name="minAmount"
            defaultValue={control?.minAmount ?? ""}
            className={fieldClass}
            inputMode="decimal"
            placeholder="Inherit"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">
            Maximum override
          </span>
          <input
            name="maxAmount"
            defaultValue={control?.maxAmount ?? ""}
            className={fieldClass}
            inputMode="decimal"
            placeholder="Inherit"
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save teacher range"}
        </Button>
        {control ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                onUpdated(
                  await deleteJson<T>(
                    `/api/v1/staff/teachers/${application.userId}/pricing`,
                  ),
                );
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Could not clear teacher pricing",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            Use inherited range
          </Button>
        ) : null}
      </div>
    </form>
  );
}
