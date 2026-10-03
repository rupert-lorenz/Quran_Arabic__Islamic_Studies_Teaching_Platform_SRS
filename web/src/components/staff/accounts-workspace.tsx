"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, getJson, patchJson, postJson } from "@/lib/api";
import { StaffFlash, StaffStat } from "./staff-stat";

type Operation = {
  id: string;
  kind: "payment" | "refund" | "credit" | "payout";
  status: string;
  amountLabel: string;
  currencyCode: string;
  reference: string | null;
  notes: string | null;
  counterpartyEmail: string | null;
  counterpartyName: string | null;
  createdAt: string | Date;
};

type Workspace = {
  summary: {
    payments: number;
    refunds: number;
    credits: number;
    payouts: number;
    open: number;
    commissionPercent: number;
  };
  currencies: { code: string; name: string; symbol: string }[];
  operations: Operation[];
};

const statuses = [
  "open",
  "in_review",
  "approved",
  "rejected",
  "completed",
  "on_hold",
] as const;

export function AccountsWorkspace({
  initial,
  canRefund,
  canPayout,
  canReport,
}: {
  initial: Workspace;
  canRefund: boolean;
  canPayout: boolean;
  canReport: boolean;
}) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const kinds = [
    { key: "payment", label: "One-off payment", allowed: true },
    { key: "refund", label: "Refund", allowed: canRefund },
    { key: "credit", label: "Platform credit", allowed: canRefund },
    { key: "payout", label: "Payout", allowed: canPayout },
  ].filter((item) => item.allowed);

  async function refresh() {
    setData(await getJson<Workspace>("/api/v1/staff/finance/operations"));
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StaffStat label="One-off payments" value={data.summary.payments} />
        <StaffStat label="Refunds" value={data.summary.refunds} />
        <StaffStat label="Platform credit" value={data.summary.credits} />
        <StaffStat label="Payouts" value={data.summary.payouts} />
        <StaffStat label="Open items" value={data.summary.open} />
      </div>
      {canReport ? (
        <p className="mt-4 rounded-[2rem] bg-mint px-5 py-4 font-semibold text-brand">
          Default platform commission is {data.summary.commissionPercent}%.{" "}
          <a href="/staff/rates" className="underline">
            Edit teacher rate limits
          </a>
          . Stripe settlement stays reserved; this register is the live
          marketplace finance queue.
        </p>
      ) : null}

      <form
        className="mt-8 rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError("");
          setMessage("");
          const form = new FormData(event.currentTarget);
          const kind = String(form.get("kind") ?? "payment");
          const coverage = String(form.get("coverage") ?? "full");
          const written = String(form.get("notes") ?? "").trim();
          const notes =
            kind === "refund"
              ? `${coverage === "partial" ? "Partial refund" : "Full refund"}${
                  written ? `. ${written}` : ""
                }`
              : written;
          try {
            await postJson("/api/v1/staff/finance/operations", {
              kind,
              amount: String(form.get("amount") ?? ""),
              currencyCode: String(form.get("currencyCode") ?? "GBP"),
              counterpartyEmail: String(form.get("counterpartyEmail") ?? ""),
              reference: String(form.get("reference") ?? ""),
              notes,
            });
            event.currentTarget.reset();
            await refresh();
            setMessage("Finance item recorded.");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save");
          } finally {
            setPending(false);
          }
        }}
      >
        <h2 className="text-xl font-extrabold text-brand">Record an item</h2>
        <p className="mt-2 text-sm text-muted">
          A one-off payment is a staff-recorded charge. Platform credit becomes
          available wallet spend when the item is completed. Credit and refund
          rows appear in Credit transaction history.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">Type</span>
            <select name="kind" className={fieldClass} defaultValue={kinds[0]?.key}>
              {kinds.map((kind) => (
                <option key={kind.key} value={kind.key}>
                  {kind.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">Amount</span>
            <input name="amount" required placeholder="25.00" className={fieldClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">Currency</span>
            <select name="currencyCode" className={fieldClass} defaultValue="GBP">
              {data.currencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} · {currency.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              Account email
            </span>
            <input
              type="email"
              name="counterpartyEmail"
              className={fieldClass}
              placeholder="Optional"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">Reference</span>
            <input name="reference" className={fieldClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              Refund coverage
            </span>
            <select name="coverage" className={fieldClass} defaultValue="full">
              <option value="full">Full refund</option>
              <option value="partial">Partial refund</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">Notes</span>
            <input name="notes" className={fieldClass} />
          </label>
        </div>
        <Button type="submit" className="mt-4" disabled={pending}>
          {pending ? "Saving…" : "Record item"}
        </Button>
      </form>

      <StaffFlash error={error} message={message} />

      <div className="mt-8 overflow-x-auto rounded-[2rem] border border-line bg-surface">
        <table className="min-w-full text-start text-sm">
          <thead className="bg-mint/70 text-brand">
            <tr>
              <th className="px-4 py-3 font-extrabold">Type</th>
              <th className="px-4 py-3 font-extrabold">Amount</th>
              <th className="px-4 py-3 font-extrabold">Account</th>
              <th className="px-4 py-3 font-extrabold">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.operations.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-muted" colSpan={4}>
                  No finance items yet.
                </td>
              </tr>
            ) : (
              data.operations.map((item) => (
                <tr key={item.id} className="border-t border-line">
                  <td className="px-4 py-3 font-bold capitalize text-brand">
                    {item.kind}
                    {item.reference ? (
                      <span className="mt-1 block text-xs font-semibold text-muted">
                        {item.reference}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{item.amountLabel}</td>
                  <td className="px-4 py-3 text-muted">
                    {item.counterpartyName ?? item.counterpartyEmail ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="min-h-10 rounded-xl border border-line bg-background px-2 font-semibold"
                      value={item.status}
                      disabled={pending}
                      onChange={async (event) => {
                        setPending(true);
                        setError("");
                        try {
                          await patchJson(
                            `/api/v1/staff/finance/operations/${item.id}`,
                            { status: event.target.value },
                          );
                          await refresh();
                        } catch (err) {
                          setError(
                            err instanceof Error ? err.message : "Could not update",
                          );
                        } finally {
                          setPending(false);
                        }
                      }}
                    >
                      {statuses.map((status) => (
                        <option key={status} value={status}>
                          {status.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
