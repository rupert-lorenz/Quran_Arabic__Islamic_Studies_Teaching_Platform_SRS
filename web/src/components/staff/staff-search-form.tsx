"use client";

import { useSearchParams } from "next/navigation";
import { fieldClass } from "@/lib/api";

export function StaffSearchForm({
  compact = false,
  query,
}: {
  compact?: boolean;
  query?: string;
}) {
  const params = useSearchParams();
  const value = query ?? params.get("q") ?? "";
  const inputId = compact ? "staff-search-nav" : "staff-search";

  return (
    <form
      action="/staff/search"
      method="get"
      role="search"
      className={
        compact
          ? "flex w-full min-w-0 max-w-xl items-center gap-2"
          : "flex flex-col gap-3 sm:flex-row"
      }
    >
      <label className="sr-only" htmlFor={inputId}>
        Search staff records
      </label>
      <input
        id={inputId}
        name="q"
        type="search"
        defaultValue={value}
        placeholder="Search users, teachers, lessons…"
        className={`${fieldClass} min-w-0`}
        autoComplete="off"
      />
      <button
        type="submit"
        className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-brand px-5 text-base font-semibold text-white shadow-sm hover:bg-brand-soft"
      >
        Search
      </button>
    </form>
  );
}
