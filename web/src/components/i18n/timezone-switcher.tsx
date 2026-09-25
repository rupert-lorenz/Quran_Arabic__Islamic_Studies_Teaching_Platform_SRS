"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { postJson } from "@/lib/api";
import { timezoneLabel } from "@/lib/geo";

export function TimezoneSwitcher({
  timezones,
  current,
  label,
  persist = true,
  tone = "default",
  compact = false,
}: {
  timezones: string[];
  current: string;
  label: string;
  persist?: boolean;
  tone?: "default" | "inverse";
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [value, setValue] = useState(current);

  useEffect(() => {
    setValue(current);
  }, [current]);

  if (timezones.length < 2) {
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
        className={`min-h-11 max-w-[13rem] rounded-full border px-3 text-sm font-bold ${
          inverse
            ? "border-white/20 bg-white/10 text-white"
            : "border-line bg-white text-brand"
        }`}
        onChange={async (event) => {
          const next = event.target.value;
          setValue(next);
          setPending(true);
          try {
            await postJson("/api/v1/timezone", { timeZone: next, persist });
            router.refresh();
          } catch {
            setValue(current);
          } finally {
            setPending(false);
          }
        }}
      >
        {timezones.map((zone) => (
          <option key={zone} value={zone}>
            {timezoneLabel(zone)} · {zone}
          </option>
        ))}
      </select>
    </label>
  );
}
