"use client";

import { useState } from "react";
import { useT } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { fieldClass, getJson, postJson } from "@/lib/api";
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from "@/lib/crm";

type Ticket = {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  ownerName: string | null;
};

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      resolve(value.slice(value.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function SupportDesk({ initial }: { initial: Ticket[] }) {
  const t = useT();
  const [tickets, setTickets] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6">
      <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
        {t("cr.tickets.title")}
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted">{t("cr.tickets.help")}</p>
      <form
        className="mt-4 space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const file = form.get("attachment");
          setPending(true);
          setError("");
          setMessage("");
          try {
            const attachment = file instanceof File && file.size ? file : null;
            await postJson("/api/v1/support/tickets", {
              subject: String(form.get("subject") ?? ""),
              body: String(form.get("body") ?? ""),
              category: String(form.get("category") ?? "other"),
              priority: String(form.get("priority") ?? "normal"),
              attachmentName: attachment?.name,
              attachmentMime: attachment?.type,
              attachmentBase64: attachment ? await fileToBase64(attachment) : undefined,
            });
            const next = await getJson<{ tickets: Ticket[] }>("/api/v1/support/tickets");
            setTickets(next.tickets);
            event.currentTarget.reset();
            setMessage(t("cr.tickets.sent"));
          } catch (err) {
            setError(err instanceof Error ? err.message : t("cr.tickets.failed"));
          } finally {
            setPending(false);
          }
        }}
      >
        <input name="subject" required minLength={3} className={fieldClass} placeholder={t("cr.tickets.subject")} />
        <textarea name="body" required minLength={10} rows={4} className={fieldClass} placeholder={t("cr.tickets.body")} />
        <div className="grid gap-3 md:grid-cols-3">
          <select name="category" className={fieldClass} defaultValue="other">
            {TICKET_CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select name="priority" className={fieldClass} defaultValue="normal">
            {TICKET_PRIORITIES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input name="attachment" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv" className={fieldClass} />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? t("cr.tickets.sending") : t("cr.tickets.send")}
        </Button>
        {message ? <p className="text-sm font-semibold text-brand">{message}</p> : null}
        {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
      </form>
      {tickets.length ? (
        <ul className="mt-6 space-y-2">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="rounded-2xl border border-line px-4 py-3 text-sm">
              <p className="font-bold text-brand">{ticket.subject}</p>
              <p className="mt-1 text-muted">
                {ticket.status} · {ticket.category} · {ticket.priority}
                {ticket.ownerName ? ` · ${ticket.ownerName}` : ""} · {ticket.createdAt.slice(0, 10)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">{t("cr.tickets.empty")}</p>
      )}
    </section>
  );
}
