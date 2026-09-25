"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { postJson } from "@/lib/api";
import type { PublicLocale } from "@/lib/i18n";

export function LanguageSwitcher({
  locales,
  current,
  label,
  tone = "default",
  compact = false,
}: {
  locales: PublicLocale[];
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

  if (locales.length < 2) {
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
            await postJson("/api/v1/locale", { locale: next });
            router.refresh();
          } catch {
            setValue(current);
          } finally {
            setPending(false);
          }
        }}
      >
        {locales.map((locale) => (
          <option key={locale.code} value={locale.code}>
            {locale.name}
          </option>
        ))}
      </select>
    </label>
  );
}
