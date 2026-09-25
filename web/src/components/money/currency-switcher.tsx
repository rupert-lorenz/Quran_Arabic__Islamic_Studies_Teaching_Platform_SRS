"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { postJson } from "@/lib/api";
import type { PublicCurrency } from "@/lib/currency";

export function CurrencySwitcher({
  currencies,
  current,
  label,
  tone = "default",
  compact = false,
}: {
  currencies: PublicCurrency[];
  current: string;
  label: string;
  tone?: "default" | "inverse";
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [value, setValue] = useState(current);

  useEffect(() => {
    setValue(current);
  }, [current]);

  if (currencies.length < 2) {
    return null;
  }

  const inverse = tone === "inverse";

  return (
    <label
      className={`inline-flex min-h-11 shrink-0 items-center text-sm font-bold ${
        compact ? "gap-0" : "gap-2"
      } ${inverse ? "text-white/85" : "text-brand"}`}
    >
      <span className={compact ? "sr-only" : inverse ? "text-white/70" : "text-muted"}>
        {label}
      </span>
      <select
        value={value}
        disabled={pending}
        aria-label={label}
        className={`min-h-11 max-w-[9.5rem] rounded-full border px-3 text-sm font-bold ${
          inverse
            ? "border-white/20 bg-white/10 text-white"
            : "border-line bg-white text-brand"
        }`}
        onChange={async (event) => {
          const next = event.target.value;
          setValue(next);
          setPending(true);
          try {
            await postJson("/api/v1/currency", { currency: next });
            router.refresh();
          } catch {
            setValue(current);
          } finally {
            setPending(false);
          }
        }}
      >
        {currencies.map((currency) => (
          <option key={currency.code} value={currency.code}>
            {currency.code} · {currency.symbol}
          </option>
        ))}
      </select>
    </label>
  );
}
