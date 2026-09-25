"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteJson, fieldClass, postJson } from "@/lib/api";
import type { TeacherRatePolicy } from "@/components/staff/staff-rate-policy";

export type PricingControlRuleView = {
  id: string;
  scope: "country" | "subject" | "teacher";
  scopeKey: string;
  label: string;
  minAmount: string;
  maxAmount: string;
  minFormatted: string;
  maxFormatted: string;
};

export type StaffRatesWorkspaceData = TeacherRatePolicy & {
  rules: PricingControlRuleView[];
  countries: { iso2: string; name: string }[];
  subjects: { slug: string; name: string }[];
  teachers: { userId: string; displayName: string; email: string }[];
};

const scopeLabels = {
  country: "Country",
  subject: "Subject",
  teacher: "Teacher",
} as const;

export function StaffPricingControls({
  data,
  canEdit,
  onUpdated,
}: {
  data: StaffRatesWorkspaceData;
  canEdit: boolean;
  onUpdated: (next: StaffRatesWorkspaceData) => void;
}) {
  const [scope, setScope] = useState<"country" | "subject" | "teacher">("country");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const keys = useMemo(() => {
    if (scope === "country") {
      return data.countries.map((item) => ({
        value: item.iso2,
        label: item.name,
      }));
    }
    if (scope === "subject") {
      return data.subjects.map((item) => ({
        value: item.slug,
        label: item.name,
      }));
    }
    return data.teachers.map((item) => ({
      value: item.userId,
      label: `${item.displayName} · ${item.email}`,
    }));
  }, [data.countries, data.subjects, data.teachers, scope]);

  return (
    <section className="mt-8 rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <p className="text-xs font-bold uppercase text-brand-soft">
        Scoped pricing controls
      </p>
      <h2 className="mt-1 text-xl font-extrabold text-brand">
        Country, subject, and teacher ranges
      </h2>
      <p className="mt-2 text-sm text-muted">
        Country and subject rules tighten the platform band. A teacher rule
        replaces that teacher’s minimum or maximum when you set one.
      </p>
      {error ? (
        <p className="mt-4 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
      {canEdit ? (
        <form
          className="mt-6 grid gap-3 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setPending(true);
            setError("");
            try {
              onUpdated(
                await postJson<StaffRatesWorkspaceData>(
                  "/api/v1/staff/rates/rules",
                  {
                    scope,
                    scopeKey: String(form.get("scopeKey") ?? ""),
                    minAmount: String(form.get("minAmount") ?? ""),
                    maxAmount: String(form.get("maxAmount") ?? ""),
                  },
                ),
              );
              event.currentTarget.reset();
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Could not save pricing control",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">Scope</span>
            <select
              className={fieldClass}
              value={scope}
              onChange={(event) =>
                setScope(event.target.value as "country" | "subject" | "teacher")
              }
            >
              <option value="country">Country</option>
              <option value="subject">Subject</option>
              <option value="teacher">Teacher</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              {scopeLabels[scope]}
            </span>
            <select name="scopeKey" required className={fieldClass}>
              <option value="">Select {scopeLabels[scope].toLowerCase()}</option>
              {keys.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              Minimum (optional)
            </span>
            <input
              name="minAmount"
              className={fieldClass}
              inputMode="decimal"
              placeholder="Inherit"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              Maximum (optional)
            </span>
            <input
              name="maxAmount"
              className={fieldClass}
              inputMode="decimal"
              placeholder="Inherit"
            />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending || keys.length === 0}>
              {pending ? "Saving…" : "Save control"}
            </Button>
          </div>
        </form>
      ) : null}
      {data.rules.length === 0 ? (
        <p className="mt-6 rounded-[2rem] bg-gold px-5 py-4 font-semibold text-brand">
          No country, subject, or teacher controls yet. The platform range applies
          to everyone.
        </p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {data.rules.map((rule) => (
            <li
              key={rule.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background px-4 py-3"
            >
              <div>
                <p className="text-sm font-extrabold text-brand">
                  {scopeLabels[rule.scope]} · {rule.label}
                </p>
                <p className="text-sm text-muted">
                  {rule.minFormatted}–{rule.maxFormatted}
                </p>
              </div>
              {canEdit ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={async () => {
                    setPending(true);
                    setError("");
                    try {
                      onUpdated(
                        await deleteJson<StaffRatesWorkspaceData>(
                          `/api/v1/staff/rates/rules/${rule.id}`,
                        ),
                      );
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Could not remove pricing control",
                      );
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
