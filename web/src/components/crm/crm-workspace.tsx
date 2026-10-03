"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, getJson, patchJson, postJson } from "@/lib/api";
import { CRM_STATUSES, TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/crm";

type Workspace = {
  accounts: {
    id: string;
    name: string;
    email: string | null;
    status: string;
    createdAt: string;
    notes: {
      id: string;
      body: string;
      authorName: string | null;
      followUpOn: string | null;
      createdAt: string;
    }[];
  }[];
  tickets: {
    id: string;
    subject: string;
    body: string;
    category: string;
    priority: string;
    status: string;
    ownerUserId: string | null;
    ownerName: string | null;
    createdAt: string;
    attachments: { id: string; name: string }[];
  }[];
  staff: { id: string; name: string }[];
};

export function CrmWorkspace({
  initial,
  canCrm,
  canTickets,
}: {
  initial: Workspace;
  canCrm: boolean;
  canTickets: boolean;
}) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function refresh() {
    setData(await getJson<Workspace>("/api/v1/crm/workspace"));
  }

  return (
    <div className="space-y-8">
      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
      {canCrm ? (
        <form
          className="rounded-[var(--radius-card)] border border-line bg-surface p-6"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setPending(true);
            setError("");
            try {
              await postJson("/api/v1/crm/accounts", {
                name: String(form.get("name") ?? ""),
                email: String(form.get("email") ?? ""),
                status: String(form.get("status") ?? "lead"),
              });
              event.currentTarget.reset();
              await refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not save the lead");
            } finally {
              setPending(false);
            }
          }}
        >
          <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
            Add a lead
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <input name="name" required minLength={2} placeholder="Name" className={fieldClass} />
            <input name="email" type="email" placeholder="Email, if you have one" className={fieldClass} />
            <select name="status" className={fieldClass} defaultValue="lead">
              {CRM_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" className="mt-4" disabled={pending}>
            Save lead
          </Button>
        </form>
      ) : null}
      {canCrm
        ? data.accounts.map((account) => (
            <article
              key={account.id}
              className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-heading text-lg font-bold tracking-tight text-brand">
                    {account.name}
                  </h3>
                  <p className="text-sm text-muted">{account.email ?? "No email recorded"}</p>
                </div>
                <select
                  className={fieldClass}
                  value={account.status}
                  disabled={pending}
                  onChange={async (event) => {
                    setPending(true);
                    setError("");
                    try {
                      await patchJson(`/api/v1/crm/accounts/${account.id}`, {
                        status: event.target.value,
                      });
                      await refresh();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Could not update");
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  {CRM_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <h4 className="mt-4 font-heading text-sm font-bold tracking-tight text-brand">
                Notes and follow-ups
              </h4>
              <ul className="mt-2 space-y-2 text-sm text-muted">
                {account.notes.map((note) => (
                  <li key={note.id}>
                    <span className="font-bold text-brand">{note.authorName ?? "Staff"}</span>
                    {" · "}
                    {note.createdAt.slice(0, 16).replace("T", " ")}
                    {note.followUpOn ? ` · follow up ${note.followUpOn.slice(0, 10)}` : ""}
                    <span className="mt-1 block">{note.body}</span>
                  </li>
                ))}
              </ul>
              <form
                className="mt-3 flex flex-wrap gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  setPending(true);
                  setError("");
                  try {
                    await postJson(`/api/v1/crm/accounts/${account.id}/notes`, {
                      body: String(form.get("body") ?? ""),
                      followUpOn: String(form.get("followUpOn") ?? ""),
                    });
                    event.currentTarget.reset();
                    await refresh();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not save the note");
                  } finally {
                    setPending(false);
                  }
                }}
              >
                <input name="body" required minLength={3} placeholder="Note" className={`${fieldClass} max-w-md`} />
                <input name="followUpOn" type="date" className={fieldClass} />
                <Button type="submit" variant="secondary" disabled={pending}>
                  Add follow-up
                </Button>
              </form>
            </article>
          ))
        : null}
      {canTickets
        ? data.tickets.map((ticket) => (
            <article
              key={ticket.id}
              className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
            >
              <h3 className="font-heading text-lg font-bold tracking-tight text-brand">
                {ticket.subject}
              </h3>
              <p className="mt-2 text-sm text-muted">{ticket.body}</p>
              <form
                className="mt-4 grid gap-3 md:grid-cols-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  setPending(true);
                  setError("");
                  try {
                    await patchJson(`/api/v1/support/tickets/${ticket.id}`, {
                      category: String(form.get("category") ?? ticket.category),
                      priority: String(form.get("priority") ?? ticket.priority),
                      status: String(form.get("status") ?? ticket.status),
                      ownerUserId: String(form.get("ownerUserId") ?? ""),
                    });
                    await refresh();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not update the ticket");
                  } finally {
                    setPending(false);
                  }
                }}
              >
                <select name="category" defaultValue={ticket.category} className={fieldClass}>
                  {TICKET_CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select name="priority" defaultValue={ticket.priority} className={fieldClass}>
                  {TICKET_PRIORITIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select name="status" defaultValue={ticket.status} className={fieldClass}>
                  {TICKET_STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select name="ownerUserId" defaultValue={ticket.ownerUserId ?? ""} className={fieldClass}>
                  <option value="">Unassigned</option>
                  {data.staff.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="secondary" disabled={pending}>
                  Save ticket
                </Button>
              </form>
              {ticket.attachments.length ? (
                <ul className="mt-3 text-sm">
                  {ticket.attachments.map((file) => (
                    <li key={file.id}>
                      <a
                        className="font-bold text-brand-accent underline"
                        href={`/api/v1/support/tickets/${ticket.id}/attachments/${file.id}`}
                      >
                        {file.name}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))
        : null}
    </div>
  );
}
