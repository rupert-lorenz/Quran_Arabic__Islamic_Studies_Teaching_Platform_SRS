"use client";

import { useState } from "react";
import { useT } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { fieldClass, postJson } from "@/lib/api";
import type { UiMessageKey } from "@/lib/i18n";
import type { SecureMessageChannel } from "@/lib/secure-messages";
import type { getSecureInbox } from "@/server/messages/service";

type Inbox = Awaited<ReturnType<typeof getSecureInbox>>;

const channelKeys: Record<SecureMessageChannel, UiMessageKey> = {
  teacher_student: "messages.channel.teacher_student",
  teacher_parent: "messages.channel.teacher_parent",
  teacher_admin: "messages.channel.teacher_admin",
  family_admin: "messages.channel.family_admin",
};

function roleKey(role: string): UiMessageKey {
  if (role === "teacher") return "messages.role.teacher";
  if (role === "parent") return "messages.role.parent";
  if (role === "student") return "messages.role.student";
  return "messages.role.admin";
}

export function SecureInbox({ initial }: { initial: Inbox }) {
  const t = useT();
  const [inbox, setInbox] = useState(initial);
  const [channel, setChannel] = useState<SecureMessageChannel>(
    initial.channels[0] ?? "family_admin",
  );
  const [recipientUserId, setRecipientUserId] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const contacts = inbox.contacts[channel] ?? [];
  const threads = inbox.threads.filter((row) => row.channel === channel);
  const open = threads.find((row) => row.id === threadId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {inbox.channels.map((item) => (
          <button
            key={item}
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              item === channel
                ? "bg-brand text-white"
                : "bg-mint text-brand"
            }`}
            onClick={() => {
              setChannel(item);
              setThreadId(null);
              setRecipientUserId("");
              setError("");
            }}
          >
            {t(channelKeys[item])}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[2rem] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
          <h2 className="font-heading text-lg font-bold tracking-tight text-brand">
            {t("messages.threads")}
          </h2>
          {threads.length ? (
            <ul className="mt-4 space-y-2">
              {threads.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={`w-full rounded-2xl border px-4 py-3 text-start ${
                      row.id === threadId ? "border-brand bg-mint" : "border-line"
                    }`}
                    onClick={() => {
                      setThreadId(row.id);
                      setRecipientUserId(row.otherUserId);
                    }}
                  >
                    <p className="font-bold text-brand">
                      {row.otherName} · {t(roleKey(row.otherRole))}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">
                      {row.preview || t("messages.empty_thread")}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">{t("messages.no_threads")}</p>
          )}
        </section>

        <section className="rounded-[2rem] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
          <h2 className="font-heading text-lg font-bold tracking-tight text-brand">
            {open
              ? `${open.otherName} · ${t(roleKey(open.otherRole))}`
              : t("messages.new")}
          </h2>
          <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto">
            {open?.messages.length ? (
              open.messages.map((item) => (
                <li
                  key={item.id}
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    item.mine ? "bg-brand text-white" : "bg-mint text-brand"
                  }`}
                >
                  <p>{item.body}</p>
                  <p className={`mt-1 text-xs ${item.mine ? "text-white/80" : "text-muted"}`}>
                    {item.createdAt.slice(0, 16).replace("T", " ")}
                  </p>
                </li>
              ))
            ) : (
              <li className="text-sm text-muted">{t("messages.no_messages")}</li>
            )}
          </ul>
          <form
            className="mt-4 space-y-3"
            onSubmit={async (event) => {
              event.preventDefault();
              setPending(true);
              setError("");
              try {
                const next = await postJson<Inbox>("/api/v1/messages", {
                  channel,
                  recipientUserId,
                  body,
                });
                setInbox(next);
                setBody("");
                const match = next.threads.find(
                  (row) =>
                    row.channel === channel && row.otherUserId === recipientUserId,
                );
                setThreadId(match?.id ?? null);
              } catch (err) {
                setError(err instanceof Error ? err.message : t("messages.failed"));
              } finally {
                setPending(false);
              }
            }}
          >
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">
                {t("messages.to")}
              </span>
              <select
                className={fieldClass}
                value={recipientUserId}
                onChange={(event) => {
                  const nextId = event.target.value;
                  setRecipientUserId(nextId);
                  const match = threads.find((row) => row.otherUserId === nextId);
                  setThreadId(match?.id ?? null);
                }}
                required
              >
                <option value="">{t("messages.choose")}</option>
                {contacts.map((person) => (
                  <option key={person.userId} value={person.userId}>
                    {person.displayName} · {t(roleKey(person.roleKey))}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">
                {t("messages.body")}
              </span>
              <textarea
                className={fieldClass}
                value={body}
                maxLength={500}
                required
                rows={4}
                onChange={(event) => setBody(event.target.value)}
              />
            </label>
            <p className="text-sm text-muted">{t("messages.contact_help")}</p>
            <Button type="submit" disabled={pending || !recipientUserId}>
              {pending ? t("messages.sending") : t("messages.send")}
            </Button>
            {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
          </form>
        </section>
      </div>
    </div>
  );
}
