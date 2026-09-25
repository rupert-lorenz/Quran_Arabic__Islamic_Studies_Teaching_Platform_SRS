"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, getJson, patchJson, postJson } from "@/lib/api";
import { StaffFlash, StaffStat } from "./staff-stat";

type Campaign = {
  id: string;
  name: string;
  status: string;
  channel: string;
  locale: string | null;
  summary: string | null;
  startsAt: string | Date | null;
  endsAt: string | Date | null;
};

type Workspace = {
  summary: { total: number; active: number; draft: number; ended: number };
  locales: { code: string; name: string }[];
  campaigns: Campaign[];
};

const statuses = ["draft", "scheduled", "active", "paused", "ended"] as const;

export function MarketingWorkspace({
  initial,
  canReport,
}: {
  initial: Workspace;
  canReport: boolean;
}) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function refresh() {
    setData(await getJson<Workspace>("/api/v1/staff/marketing/campaigns"));
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StaffStat label="Campaigns" value={data.summary.total} />
        <StaffStat label="Active" value={data.summary.active} />
        <StaffStat label="Draft" value={data.summary.draft} />
        <StaffStat label="Ended" value={data.summary.ended} />
      </div>
      {canReport ? (
        <p className="mt-4 rounded-[2rem] bg-mint px-5 py-4 font-semibold text-brand">
          Campaign counts are the current marketing report. Edit public pages and
          banners in Content.
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
          try {
            await postJson("/api/v1/staff/marketing/campaigns", {
              name: String(form.get("name") ?? ""),
              channel: String(form.get("channel") ?? "email"),
              locale: String(form.get("locale") ?? ""),
              summary: String(form.get("summary") ?? ""),
              startsAt: String(form.get("startsAt") ?? ""),
              endsAt: String(form.get("endsAt") ?? ""),
            });
            event.currentTarget.reset();
            await refresh();
            setMessage("Campaign created.");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save");
          } finally {
            setPending(false);
          }
        }}
      >
        <h2 className="text-xl font-extrabold text-brand">New campaign</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">Name</span>
            <input name="name" required minLength={2} className={fieldClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">Channel</span>
            <select name="channel" className={fieldClass} defaultValue="email">
              <option value="email">Email</option>
              <option value="banner">Banner</option>
              <option value="social">Social</option>
              <option value="referral">Referral</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">Locale</span>
            <select name="locale" className={fieldClass} defaultValue="">
              <option value="">Any</option>
              {data.locales.map((locale) => (
                <option key={locale.code} value={locale.code}>
                  {locale.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">Summary</span>
            <input name="summary" className={fieldClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">Starts</span>
            <input type="datetime-local" name="startsAt" className={fieldClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">Ends</span>
            <input type="datetime-local" name="endsAt" className={fieldClass} />
          </label>
        </div>
        <Button type="submit" className="mt-4" disabled={pending}>
          {pending ? "Saving…" : "Create campaign"}
        </Button>
      </form>

      <StaffFlash error={error} message={message} />

      <ul className="mt-8 grid gap-4">
        {data.campaigns.length === 0 ? (
          <li className="rounded-[2rem] bg-gold px-5 py-4 font-semibold text-brand">
            No campaigns yet.
          </li>
        ) : (
          data.campaigns.map((campaign) => (
            <li
              key={campaign.id}
              className="rounded-[2rem] border border-line bg-surface p-5 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-extrabold text-brand">{campaign.name}</h3>
                  <p className="text-sm text-muted">
                    {campaign.channel}
                    {campaign.locale ? ` · ${campaign.locale}` : ""}
                    {campaign.summary ? ` · ${campaign.summary}` : ""}
                  </p>
                </div>
                <select
                  className="min-h-10 rounded-xl border border-line bg-background px-2 font-semibold"
                  value={campaign.status}
                  disabled={pending}
                  onChange={async (event) => {
                    setPending(true);
                    setError("");
                    try {
                      await patchJson(
                        `/api/v1/staff/marketing/campaigns/${campaign.id}`,
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
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
