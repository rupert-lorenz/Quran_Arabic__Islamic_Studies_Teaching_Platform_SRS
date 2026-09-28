"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, patchJson } from "@/lib/api";
import {
  PLATFORM_NOTICE_OPTIONS_MINUTES,
  formatNoticeDuration,
  noticeOptionMinutes,
} from "@/lib/booking";
import { previewTeacherRate } from "@/lib/teacher-rate-display";
import { TeacherRateBreakdown } from "@/components/teachers/teacher-rate-breakdown";

export type TeacherRatePolicy = {
  minAmount: string;
  maxAmount: string;
  minFormatted: string;
  maxFormatted: string;
  commissionPercent: number;
  commissionFixedMinor: number;
  commissionFixedAmount: string;
  lessonDurationMinutes: number;
  defaultCurrencyCode: string;
  currencies: { code: string; name: string; symbol: string; decimalPlaces: number }[];
  minNoticeMinutes: number;
  cancelNoticeMinutes: number;
  minCommitmentLessons: number;
};

export function StaffRatePolicy({
  initial,
  canEdit,
  onUpdated,
}: {
  initial: TeacherRatePolicy;
  canEdit: boolean;
  onUpdated?: (next: TeacherRatePolicy) => void;
}) {
  const [policy, setPolicy] = useState(initial);
  const [exampleAmount, setExampleAmount] = useState(initial.minAmount);
  const [exampleCommission, setExampleCommission] = useState(
    initial.commissionPercent,
  );
  const [exampleFixedMinor, setExampleFixedMinor] = useState(
    initial.commissionFixedMinor,
  );
  const [exampleCurrency, setExampleCurrency] = useState(
    initial.defaultCurrencyCode,
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const exampleCurrencyRow =
    policy.currencies.find((item) => item.code === exampleCurrency) ??
    policy.currencies[0];
  const exampleSplit = useMemo(
    () =>
      exampleCurrencyRow
        ? previewTeacherRate({
            amount: exampleAmount,
            commissionPercent: exampleCommission,
            commissionFixedMinor: exampleFixedMinor,
            currency: exampleCurrencyRow,
          })
        : null,
    [exampleAmount, exampleCommission, exampleCurrencyRow, exampleFixedMinor],
  );

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <p className="text-xs font-bold uppercase text-brand-soft">
        Platform rate policy
      </p>
      <h2 className="mt-1 text-xl font-extrabold text-brand">
        {policy.minFormatted}–{policy.maxFormatted} · {policy.commissionPercent}%
        {policy.commissionFixedMinor
          ? ` + ${policy.commissionFixedAmount} fixed`
          : ""}{" "}
        commission
      </h2>
      <p className="mt-2 text-sm text-muted">
        Teachers set their own hourly rate inside this range. Percentage
        commission is 0–80. Fixed commission is optional and is added after
        the percent cut, in the default currency. Automatic commission applies
        this cut whenever earnings are calculated. The student price, platform
        commission, and teacher earnings update automatically.
        Families must book at least {formatNoticeDuration(policy.minNoticeMinutes)}{" "}
        ahead, and cancel or reschedule at least{" "}
        {formatNoticeDuration(policy.cancelNoticeMinutes)} before the lesson.
        Earlier family cancellations go to credit review; later cancellations
        forfeit the lesson value. Teacher and staff cancellations carry no
        student charge.
        Recurring lessons need at least {policy.minCommitmentLessons} booking
        {policy.minCommitmentLessons === 1 ? "" : "s"}. Teachers can require a
        longer booking notice and a larger commitment, but never below these
        platform floors.
      </p>
      {exampleSplit ? (
        <div className="mt-4 rounded-[1.5rem] bg-mint/60 p-4">
          <TeacherRateBreakdown
            rate={exampleSplit}
            durationMinutes={policy.lessonDurationMinutes}
            revealInternalPayment
            title="Automatic price split"
          />
        </div>
      ) : null}
      {canEdit ? (
        <form
          key={`${policy.minAmount}-${policy.maxAmount}-${policy.defaultCurrencyCode}-${policy.minNoticeMinutes}-${policy.cancelNoticeMinutes}-${policy.minCommitmentLessons}`}
          className="mt-6 grid gap-3 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setPending(true);
            setError("");
            setMessage("");
            try {
              const next = await patchJson<TeacherRatePolicy>(
                "/api/v1/staff/rates",
                {
                  minAmount: String(form.get("minAmount") ?? ""),
                  maxAmount: String(form.get("maxAmount") ?? ""),
                  commissionPercent: Number(form.get("commissionPercent")),
                  commissionFixedAmount: String(
                    form.get("commissionFixedAmount") ?? "0",
                  ),
                  defaultCurrencyCode: String(
                    form.get("defaultCurrencyCode") ?? "",
                  ),
                  lessonDurationMinutes: Number(
                    form.get("lessonDurationMinutes"),
                  ),
                  minNoticeMinutes: Number(form.get("minNoticeMinutes")),
                  cancelNoticeMinutes: Number(form.get("cancelNoticeMinutes")),
                  minCommitmentLessons: Number(
                    form.get("minCommitmentLessons"),
                  ),
                },
              );
              setPolicy(next);
              setExampleAmount(next.minAmount);
              setExampleCommission(next.commissionPercent);
              setExampleFixedMinor(next.commissionFixedMinor);
              setExampleCurrency(next.defaultCurrencyCode);
              onUpdated?.(next);
              setMessage("Rate policy saved.");
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Could not save rate policy",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              Minimum hourly rate
            </span>
            <input
              name="minAmount"
              required
              defaultValue={policy.minAmount}
              className={fieldClass}
              inputMode="decimal"
              onChange={(event) => setExampleAmount(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              Maximum hourly rate
            </span>
            <input
              name="maxAmount"
              required
              defaultValue={policy.maxAmount}
              className={fieldClass}
              inputMode="decimal"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              Platform commission %
            </span>
            <input
              name="commissionPercent"
              type="number"
              min={0}
              max={80}
              required
              defaultValue={policy.commissionPercent}
              className={fieldClass}
              onChange={(event) =>
                setExampleCommission(Number(event.target.value) || 0)
              }
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              Fixed commission
            </span>
            <input
              name="commissionFixedAmount"
              defaultValue={policy.commissionFixedAmount}
              className={fieldClass}
              inputMode="decimal"
              onChange={(event) => {
                const decimals = exampleCurrencyRow?.decimalPlaces ?? 2;
                const raw = event.target.value.trim();
                if (!raw) {
                  setExampleFixedMinor(0);
                  return;
                }
                const [whole, fraction = ""] = raw.split(".");
                if (!/^\d+$/.test(whole) || fraction.length > decimals) {
                  return;
                }
                setExampleFixedMinor(
                  Number(whole) * 10 ** decimals +
                    Number(fraction.padEnd(decimals, "0") || "0"),
                );
              }}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              Default currency
            </span>
            <select
              name="defaultCurrencyCode"
              className={fieldClass}
              defaultValue={policy.defaultCurrencyCode}
              onChange={(event) => setExampleCurrency(event.target.value)}
            >
              {policy.currencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} · {currency.symbol} · {currency.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-bold text-brand">
              Default lesson length (minutes)
            </span>
            <input
              name="lessonDurationMinutes"
              type="number"
              min={15}
              max={180}
              required
              defaultValue={policy.lessonDurationMinutes}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              Platform minimum booking notice
            </span>
            <select
              name="minNoticeMinutes"
              className={fieldClass}
              defaultValue={policy.minNoticeMinutes}
              required
            >
              {noticeOptionMinutes(
                policy.minNoticeMinutes,
                PLATFORM_NOTICE_OPTIONS_MINUTES,
              ).map((minutes) => (
                <option key={minutes} value={minutes}>
                  {formatNoticeDuration(minutes)}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-semibold text-muted">
              Teachers can ask for more notice on their availability page.
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              Cancel / reschedule notice (minutes)
            </span>
            <input
              name="cancelNoticeMinutes"
              type="number"
              min={0}
              max={20160}
              required
              defaultValue={policy.cancelNoticeMinutes}
              className={fieldClass}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-sm font-bold text-brand">
              Minimum lesson commitment
            </span>
            <input
              name="minCommitmentLessons"
              type="number"
              min={1}
              max={12}
              required
              defaultValue={policy.minCommitmentLessons}
              className={fieldClass}
            />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save rate policy"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-4 rounded-2xl bg-gold px-4 py-3 text-sm font-semibold text-brand">
          You can view the current limits. Changing them needs settings.write or
          teacher approval permission.
        </p>
      )}
      {error ? (
        <p className="mt-4 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-brand">
          {message}
        </p>
      ) : null}
    </section>
  );
}
