"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/lib/api";
import { previewTeacherRate } from "@/lib/teacher-rate-display";
import { TeacherRateBreakdown } from "@/components/teachers/teacher-rate-breakdown";

export function TeacherRateLivePreview({
  initialAmount,
  initialCurrencyCode,
  currencies,
  commissionPercent,
  durationMinutes,
  pending = false,
  submitLabel = "Save rate",
  onSubmit,
}: {
  initialAmount: string;
  initialCurrencyCode: string;
  currencies: { code: string; name: string; symbol: string; decimalPlaces: number }[];
  commissionPercent: number;
  durationMinutes?: number;
  pending?: boolean;
  submitLabel?: string;
  onSubmit: (input: { amount: string; currencyCode: string }) => Promise<void>;
}) {
  const [amount, setAmount] = useState(initialAmount);
  const [currencyCode, setCurrencyCode] = useState(initialCurrencyCode);
  const currency =
    currencies.find((item) => item.code === currencyCode) ?? currencies[0];
  const preview = useMemo(
    () =>
      currency
        ? previewTeacherRate({
            amount,
            commissionPercent,
            currency,
          })
        : null,
    [amount, commissionPercent, currency],
  );

  return (
    <div>
      {preview ? (
        <div className="mt-3 rounded-[1.5rem] bg-mint/60 p-4">
          <TeacherRateBreakdown
            rate={preview}
            durationMinutes={durationMinutes}
            revealInternalPayment
            title="Live split"
          />
        </div>
      ) : (
        <p className="mt-3 text-sm font-semibold text-brand">
          Enter an hourly rate to see the student price, platform commission, and
          teacher earnings.
        </p>
      )}
      <form
        className="mt-4 grid gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          await onSubmit({ amount, currencyCode });
        }}
      >
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">
            Hourly rate
          </span>
          <input
            name="amount"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className={fieldClass}
            inputMode="decimal"
            placeholder="15.00"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">Currency</span>
          <select
            name="currencyCode"
            className={fieldClass}
            value={currencyCode}
            onChange={(event) => setCurrencyCode(event.target.value)}
          >
            {currencies.map((item) => (
              <option key={item.code} value={item.code}>
                {item.code} · {item.symbol} · {item.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </form>
    </div>
  );
}
