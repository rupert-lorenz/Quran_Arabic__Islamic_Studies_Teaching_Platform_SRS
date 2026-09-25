"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, postJson } from "@/lib/api";

export type PublishedAgreement = {
  version: string;
  title: string;
  clauses: string[];
};

function nextVersion(version: string) {
  const match = version.match(/^(.*?)(\d+)$/);
  if (!match) {
    return `${version}-2`;
  }
  return `${match[1]}${Number(match[2]) + 1}`;
}

export function TeacherAgreementPublisher({
  initial,
  canPublish = false,
}: {
  initial: PublishedAgreement;
  canPublish?: boolean;
}) {
  const [current, setCurrent] = useState(initial);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <section className="mb-8 rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <p className="text-xs font-bold uppercase text-brand-soft">
        Teacher agreement
      </p>
      <h2 className="mt-1 text-xl font-extrabold text-brand">{current.title}</h2>
      <p className="mt-1 text-sm text-muted">
        Current version {current.version}. Teachers who signed an older version
        must sign again.
      </p>
      <ul className="mt-4 list-disc space-y-2 ps-5 text-sm text-brand">
        {current.clauses.map((clause) => (
          <li key={clause}>{clause}</li>
        ))}
      </ul>
      {canPublish ? (
        <form
          key={current.version}
          className="mt-6 grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const clauses = String(form.get("clauses") ?? "")
              .split(/\r?\n/)
              .map((item) => item.trim())
              .filter(Boolean);
            setPending(true);
            setError("");
            setMessage("");
            try {
              const next = await postJson<PublishedAgreement>(
                "/api/v1/staff/agreements",
                {
                  version: String(form.get("version") ?? ""),
                  title: String(form.get("title") ?? ""),
                  clauses,
                },
              );
              setCurrent(next);
              setMessage(`Published ${next.version}.`);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not publish");
            } finally {
              setPending(false);
            }
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              New version
            </span>
            <input
              name="version"
              required
              minLength={3}
              maxLength={40}
              defaultValue={nextVersion(current.version)}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">Title</span>
            <input
              name="title"
              required
              minLength={4}
              maxLength={160}
              defaultValue={current.title}
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              Clauses (one per line, at least three)
            </span>
            <textarea
              name="clauses"
              required
              rows={6}
              defaultValue={current.clauses.join("\n")}
              className={fieldClass}
            />
          </label>
          <Button type="submit" disabled={pending}>
            Publish new terms
          </Button>
        </form>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-brand">
          {message}
        </p>
      ) : null}
    </section>
  );
}
