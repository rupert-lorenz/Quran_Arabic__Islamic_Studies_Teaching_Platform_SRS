"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, getJson, patchJson, postJson } from "@/lib/api";
import { StaffFlash, StaffStat } from "./staff-stat";

type Note = { id: string; body: string; createdAt: string | Date };

type Incident = {
  id: string;
  title: string;
  severity: string;
  status: string;
  summary: string;
  involvedUserId: string | null;
  involvedEmail: string | null;
  involvedName: string | null;
  involvedStatus: string | null;
  notes: Note[];
};

type Recording = {
  id: string;
  reference: string;
  status: string;
  notes: string | null;
  relatedEmail: string | null;
  relatedName: string | null;
};

type Workspace = {
  summary: { openIncidents: number; critical: number; flaggedRecordings: number };
  incidents: Incident[];
  recordings: Recording[];
  recentAudit: {
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    createdAt: string | Date;
  }[];
};

const incidentStatuses = [
  "open",
  "investigating",
  "escalated",
  "resolved",
  "closed",
] as const;

export function SafeguardingWorkspace({
  initial,
  canIncidents,
  canRecordings,
  canSuspend,
  canReadAudit,
}: {
  initial: Workspace;
  canIncidents: boolean;
  canRecordings: boolean;
  canSuspend: boolean;
  canReadAudit: boolean;
}) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function refresh() {
    setData(await getJson<Workspace>("/api/v1/staff/safeguarding/incidents"));
  }

  return (
    <div>
      <p className="rounded-[2rem] bg-gold px-5 py-4 font-semibold text-brand">
        Restricted workspace. Only staff with safeguarding permissions can see
        incidents, notes, and recording reviews.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StaffStat label="Open incidents" value={data.summary.openIncidents} />
        <StaffStat label="Critical" value={data.summary.critical} />
        <StaffStat label="Flagged recordings" value={data.summary.flaggedRecordings} />
      </div>

      {canIncidents ? (
        <form
          className="mt-8 rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            setMessage("");
            const form = new FormData(event.currentTarget);
            try {
              await postJson("/api/v1/staff/safeguarding/incidents", {
                title: String(form.get("title") ?? ""),
                severity: String(form.get("severity") ?? "medium"),
                involvedEmail: String(form.get("involvedEmail") ?? ""),
                summary: String(form.get("summary") ?? ""),
              });
              event.currentTarget.reset();
              await refresh();
              setMessage("Incident logged.");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not save");
            } finally {
              setPending(false);
            }
          }}
        >
          <h2 className="text-xl font-extrabold text-brand">Log incident</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">Title</span>
              <input name="title" required minLength={3} className={fieldClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">Severity</span>
              <select name="severity" className={fieldClass} defaultValue="medium">
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
                <option value="critical">critical</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">
                Involved account email
              </span>
              <input type="email" name="involvedEmail" className={fieldClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">Summary</span>
              <input name="summary" required minLength={10} className={fieldClass} />
            </label>
          </div>
          <Button type="submit" className="mt-4" disabled={pending}>
            {pending ? "Saving…" : "Log incident"}
          </Button>
        </form>
      ) : null}

      <StaffFlash error={error} message={message} />

      {canIncidents ? (
        <ul className="mt-8 grid gap-4">
          {data.incidents.map((incident) => (
            <li
              key={incident.id}
              className="rounded-[2rem] border border-line bg-surface p-5 shadow-[var(--shadow-card)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-extrabold text-brand">
                    {incident.title}
                  </h3>
                  <p className="text-sm text-muted">
                    {incident.severity} · {incident.involvedName ?? "No account linked"}
                    {incident.involvedEmail ? ` · ${incident.involvedEmail}` : ""}
                    {incident.involvedStatus ? ` · ${incident.involvedStatus}` : ""}
                  </p>
                  <p className="mt-2 text-sm text-brand">{incident.summary}</p>
                </div>
                <select
                  className="min-h-10 rounded-xl border border-line bg-background px-2 font-semibold"
                  value={incident.status}
                  disabled={pending}
                  onChange={async (event) => {
                    setPending(true);
                    setError("");
                    try {
                      await patchJson(
                        `/api/v1/staff/safeguarding/incidents/${incident.id}`,
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
                  {incidentStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              {incident.notes.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm text-muted">
                  {incident.notes.map((note) => (
                    <li key={note.id}>{note.body}</li>
                  ))}
                </ul>
              ) : null}
              <form
                className="mt-4 flex flex-wrap gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  setPending(true);
                  setError("");
                  try {
                    await postJson(
                      `/api/v1/staff/safeguarding/incidents/${incident.id}/notes`,
                      { body: String(form.get("body") ?? "") },
                    );
                    event.currentTarget.reset();
                    await refresh();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not add note");
                  } finally {
                    setPending(false);
                  }
                }}
              >
                <input
                  name="body"
                  required
                  minLength={3}
                  placeholder="Add a note"
                  className={`${fieldClass} max-w-md`}
                />
                <Button type="submit" variant="secondary" disabled={pending}>
                  Add note
                </Button>
                {canSuspend &&
                incident.involvedUserId &&
                incident.involvedStatus !== "suspended" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending}
                    onClick={async () => {
                      setPending(true);
                      setError("");
                      try {
                        await postJson(
                          `/api/v1/staff/safeguarding/incidents/${incident.id}/suspend`,
                          {},
                        );
                        await refresh();
                        setMessage("Involved account suspended.");
                      } catch (err) {
                        setError(
                          err instanceof Error ? err.message : "Could not suspend",
                        );
                      } finally {
                        setPending(false);
                      }
                    }}
                  >
                    Suspend account
                  </Button>
                ) : null}
              </form>
            </li>
          ))}
        </ul>
      ) : null}

      {canRecordings ? (
        <>
          <form
            className="mt-8 rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
            onSubmit={async (event) => {
              event.preventDefault();
              setPending(true);
              setError("");
              setMessage("");
              const form = new FormData(event.currentTarget);
              try {
                await postJson("/api/v1/staff/safeguarding/recordings", {
                  reference: String(form.get("reference") ?? ""),
                  relatedEmail: String(form.get("relatedEmail") ?? ""),
                  notes: String(form.get("notes") ?? ""),
                });
                event.currentTarget.reset();
                await refresh();
                setMessage("Recording flagged for review.");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not save");
              } finally {
                setPending(false);
              }
            }}
          >
            <h2 className="text-xl font-extrabold text-brand">Flag a recording</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-sm font-bold text-brand">
                  Reference
                </span>
                <input name="reference" required minLength={2} className={fieldClass} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold text-brand">
                  Related email
                </span>
                <input type="email" name="relatedEmail" className={fieldClass} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold text-brand">Notes</span>
                <input name="notes" className={fieldClass} />
              </label>
            </div>
            <Button type="submit" className="mt-4" disabled={pending}>
              {pending ? "Saving…" : "Flag recording"}
            </Button>
          </form>
          <ul className="mt-6 grid gap-3">
            {data.recordings.map((recording) => (
              <li
                key={recording.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-line bg-surface px-5 py-4"
              >
                <div>
                  <h3 className="font-extrabold text-brand">{recording.reference}</h3>
                  <p className="text-sm text-muted">
                    {recording.relatedName ?? recording.relatedEmail ?? "No account"}
                    {recording.notes ? ` · ${recording.notes}` : ""}
                  </p>
                </div>
                <select
                  className="min-h-10 rounded-xl border border-line bg-background px-2 font-semibold"
                  value={recording.status}
                  disabled={pending}
                  onChange={async (event) => {
                    setPending(true);
                    setError("");
                    try {
                      await patchJson(
                        `/api/v1/staff/safeguarding/recordings/${recording.id}`,
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
                  <option value="flagged">flagged</option>
                  <option value="under_review">under review</option>
                  <option value="cleared">cleared</option>
                  <option value="retained">retained</option>
                </select>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {canReadAudit ? (
        <section className="mt-10">
          <h2 className="text-xl font-extrabold text-brand">Recent audit</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {data.recentAudit.map((entry) => (
              <li key={entry.id}>
                {entry.action} · {entry.entityType}
                {entry.entityId ? ` · ${entry.entityId}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
