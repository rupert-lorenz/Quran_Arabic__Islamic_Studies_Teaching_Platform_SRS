"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, patchJson, postJson } from "@/lib/api";
import { StaffFlash, StaffStat } from "./staff-stat";

type Country = {
  iso2: string;
  iso3: string;
  name: string;
  defaultTimezone: string;
  defaultCurrencyCode: string;
  currencyName: string;
  currencySymbol: string;
  isEnabled: boolean;
  sortOrder: number;
  userCount: number;
};

type Currency = {
  code: string;
  name: string;
  symbol: string;
};

type Workspace = {
  summary: {
    countries: number;
    enabled: number;
    hidden: number;
  };
  countries: Country[];
  currencies: Currency[];
  timezones: string[];
};

export function StaffCountries({ initial }: { initial: Workspace }) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StaffStat label="Countries" value={data.summary.countries} />
        <StaffStat label="Available" value={data.summary.enabled} />
        <StaffStat label="Hidden" value={data.summary.hidden} />
      </div>
      <p className="mt-4 text-sm leading-6 text-muted">
        Hidden countries stay on existing accounts but cannot be chosen on new
        profiles, applications, or public teacher filters.
      </p>

      <form
        className="mt-8 rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError("");
          setMessage("");
          const form = new FormData(event.currentTarget);
          try {
            setData(
              await postJson<Workspace>("/api/v1/staff/countries", {
                iso2: String(form.get("iso2") ?? ""),
                iso3: String(form.get("iso3") ?? ""),
                name: String(form.get("name") ?? ""),
                defaultTimezone: String(form.get("defaultTimezone") ?? ""),
                defaultCurrencyCode: String(form.get("defaultCurrencyCode") ?? ""),
                sortOrder: Number(form.get("sortOrder") ?? 100),
              }),
            );
            event.currentTarget.reset();
            setMessage("Country added.");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save");
          } finally {
            setPending(false);
          }
        }}
      >
        <h2 className="text-xl font-extrabold text-brand">Add country</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">Name</span>
            <input name="name" required minLength={2} className={fieldClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              Timezone
            </span>
            <select name="defaultTimezone" required className={fieldClass}>
              {data.timezones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              ISO 2
            </span>
            <input
              name="iso2"
              required
              minLength={2}
              maxLength={2}
              placeholder="KE"
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              ISO 3
            </span>
            <input
              name="iso3"
              required
              minLength={3}
              maxLength={3}
              placeholder="KEN"
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              Default currency
            </span>
            <select name="defaultCurrencyCode" required className={fieldClass}>
              {data.currencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} · {currency.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              Sort order
            </span>
            <input
              name="sortOrder"
              type="number"
              min={0}
              max={9999}
              defaultValue={100}
              className={fieldClass}
            />
          </label>
        </div>
        <Button type="submit" className="mt-4" disabled={pending}>
          {pending ? "Saving…" : "Add country"}
        </Button>
      </form>

      <StaffFlash error={error} message={message} />

      <ul className="mt-8 grid gap-4">
        {data.countries.map((country) => {
          const zones = [
            ...new Set([...data.timezones, country.defaultTimezone]),
          ].sort((left, right) => left.localeCompare(right));
          return (
            <li
              key={country.iso2}
              className="rounded-[2rem] border border-line bg-surface p-5 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-extrabold text-brand">
                    {country.name}
                  </h3>
                  <p className="text-sm text-muted">
                    {country.iso2} · {country.iso3} · {country.defaultTimezone} ·{" "}
                    {country.currencySymbol}
                    {country.defaultCurrencyCode}
                    {country.userCount
                      ? ` · ${country.userCount} ${
                          country.userCount === 1 ? "account" : "accounts"
                        }`
                      : ""}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={async () => {
                    setPending(true);
                    setError("");
                    setMessage("");
                    try {
                      setData(
                        await patchJson<Workspace>(
                          `/api/v1/staff/countries/${country.iso2}`,
                          { isEnabled: !country.isEnabled },
                        ),
                      );
                      setMessage(
                        country.isEnabled
                          ? `${country.name} is hidden from new sign-ups.`
                          : `${country.name} is available again.`,
                      );
                    } catch (err) {
                      setError(
                        err instanceof Error ? err.message : "Could not update",
                      );
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  {country.isEnabled ? "Hide" : "Enable"}
                </Button>
              </div>
              <form
                className="mt-4 grid gap-3 md:grid-cols-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  setPending(true);
                  setError("");
                  setMessage("");
                  const form = new FormData(event.currentTarget);
                  try {
                    setData(
                      await patchJson<Workspace>(
                        `/api/v1/staff/countries/${country.iso2}`,
                        {
                          name: String(form.get("name") ?? ""),
                          defaultTimezone: String(
                            form.get("defaultTimezone") ?? "",
                          ),
                          defaultCurrencyCode: String(
                            form.get("defaultCurrencyCode") ?? "",
                          ),
                          sortOrder: Number(form.get("sortOrder") ?? country.sortOrder),
                        },
                      ),
                    );
                    setMessage(`${country.name} updated.`);
                  } catch (err) {
                    setError(
                      err instanceof Error ? err.message : "Could not update",
                    );
                  } finally {
                    setPending(false);
                  }
                }}
              >
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-brand">
                    Name
                  </span>
                  <input
                    name="name"
                    required
                    defaultValue={country.name}
                    className={fieldClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-brand">
                    Timezone
                  </span>
                  <select
                    name="defaultTimezone"
                    defaultValue={country.defaultTimezone}
                    className={fieldClass}
                  >
                    {zones.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-brand">
                    Currency
                  </span>
                  <select
                    name="defaultCurrencyCode"
                    defaultValue={country.defaultCurrencyCode}
                    className={fieldClass}
                  >
                    {data.currencies.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.code} · {currency.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-brand">
                    Sort order
                  </span>
                  <input
                    name="sortOrder"
                    type="number"
                    min={0}
                    max={9999}
                    defaultValue={country.sortOrder}
                    className={fieldClass}
                  />
                </label>
                <div className="md:col-span-2">
                  <Button type="submit" variant="secondary" disabled={pending}>
                    Save
                  </Button>
                  <span className="ms-3 text-xs font-bold uppercase tracking-wide text-brand-soft">
                    {country.isEnabled ? "Available" : "Hidden"}
                  </span>
                </div>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
