"use client";

import { useState } from "react";
import { useT } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { fieldClass, patchJson, putJson } from "@/lib/api";
import { StaffFlash, StaffStat } from "./staff-stat";

type CurrencyRow = {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isEnabled: boolean;
  isDefault: boolean;
  hasRate?: boolean;
  rate: string;
  asOf: string | null;
};

type Workspace = {
  defaultCurrency: string;
  canManage: boolean;
  summary: {
    currencies: number;
    enabled: number;
    rates: number;
  };
  currencies: CurrencyRow[];
};

export function StaffCurrencies({ initial }: { initial: Workspace }) {
  const t = useT();
  const [data, setData] = useState(initial);
  const [rates, setRates] = useState<Record<string, string>>(
    Object.fromEntries(initial.currencies.map((item) => [item.code, item.rate])),
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function save<T>(task: () => Promise<T>, ok: string) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const next = (await task()) as Workspace;
      setData(next);
      setRates(Object.fromEntries(next.currencies.map((item) => [item.code, item.rate])));
      setMessage(ok);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StaffStat label={t("currency.faculty.catalogue")} value={data.summary.currencies} />
        <StaffStat label={t("currency.faculty.available")} value={data.summary.enabled} />
        <StaffStat label={t("currency.faculty.rates")} value={data.summary.rates} />
      </div>
      <p className="mt-4 text-sm leading-6 text-muted">
        {t("currency.faculty.staff_help", { code: data.defaultCurrency })}
      </p>
      <StaffFlash error={error} message={message} />

      <div className="mt-6 overflow-x-auto rounded-[2rem] border border-line bg-surface">
        <table className="min-w-full text-start text-sm">
          <thead>
            <tr className="border-b border-line text-xs font-bold uppercase text-muted">
              <th className="px-4 py-3">{t("currency.faculty.code")}</th>
              <th className="px-4 py-3">{t("currency.faculty.name")}</th>
              <th className="px-4 py-3">
                {t("currency.faculty.rate_for", { code: data.defaultCurrency })}
              </th>
              <th className="px-4 py-3">{t("currency.faculty.available")}</th>
            </tr>
          </thead>
          <tbody>
            {data.currencies.map((currency) => (
              <tr key={currency.code} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-extrabold text-brand">
                  {currency.symbol} {currency.code}
                  {currency.isDefault ? (
                    <span className="ms-2 text-xs uppercase text-brand-soft">
                      {t("currency.faculty.default")}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-brand">
                  {currency.name}
                  <span className="ms-2 text-xs text-muted">
                    {currency.decimalPlaces} dp
                  </span>
                </td>
                <td className="px-4 py-3">
                  {currency.isDefault ? (
                    <span className="font-semibold text-brand">1</span>
                  ) : (
                    <form
                      className="flex flex-wrap items-center gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (!data.canManage) return;
                        void save(
                          () =>
                            putJson("/api/v1/staff/currencies", {
                              quoteCode: currency.code,
                              rate: rates[currency.code] ?? "",
                            }),
                          `Updated ${currency.code} rate`,
                        );
                      }}
                    >
                      <input
                        className={`${fieldClass} max-w-36`}
                        value={rates[currency.code] ?? ""}
                        disabled={!data.canManage || pending}
                        inputMode="decimal"
                        onChange={(event) =>
                          setRates((current) => ({
                            ...current,
                            [currency.code]: event.target.value,
                          }))
                        }
                      />
                      {data.canManage ? (
                        <Button type="submit" variant="secondary" disabled={pending}>
                          Save
                        </Button>
                      ) : null}
                    </form>
                  )}
                </td>
                <td className="px-4 py-3">
                  <label className="inline-flex items-center gap-2 font-semibold text-brand">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-brand"
                      checked={currency.isEnabled}
                      disabled={!data.canManage || pending || currency.isDefault}
                      onChange={(event) => {
                        if (!data.canManage) return;
                        void save(
                          () =>
                            patchJson(`/api/v1/staff/currencies/${currency.code}`, {
                              isEnabled: event.target.checked,
                            }),
                          `${currency.code} updated`,
                        );
                      }}
                    />
                    {currency.isEnabled
                      ? t("pay.live")
                      : t("currency.faculty.hidden")}
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
