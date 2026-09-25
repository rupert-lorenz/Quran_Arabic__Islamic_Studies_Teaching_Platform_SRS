"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { LibraryExpiryLabel } from "@/components/lms/library-expiry-label";
import { fieldClass, postJson } from "@/lib/api";
import type { LibraryExpiryKind } from "@/lib/library-materials";
import type { LibraryExpiryDesk } from "@/server/lms/expiry";

const kindKeys = {
  purchase: "library.purchase.title",
  rental: "library.rental.title",
  subscription: "library.subscription.title",
  licence: "library.licence.title",
  grant: "library.access.grants",
} as const;

export function LibraryExpiryPanel({
  initial,
}: {
  initial: LibraryExpiryDesk;
}) {
  const t = useT();
  const [desk, setDesk] = useState(initial);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function run(body: Record<string, unknown>) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const next = await postJson<LibraryExpiryDesk>(
        "/api/v1/library/expiry",
        body,
      );
      setDesk(next);
      setMessage(t("library.expiry.saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("library.failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
        {t("library.expiry.title")}
      </h2>
      <p className="mt-2 text-sm font-semibold text-muted">
        {t("library.expiry.help")}
      </p>

      {desk.rows.length ? (
        <ul className="mt-6 grid gap-3">
          {desk.rows.map((row) => (
            <li
              key={`${row.kind}-${row.id}`}
              className="rounded-2xl bg-background px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-heading font-bold tracking-tight text-brand">
                    {row.studentName} · {row.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-muted">
                    {t(kindKeys[row.kind as LibraryExpiryKind])}
                    {` · `}
                    <LibraryExpiryLabel expiresAt={row.expiresAt} />
                  </p>
                </div>
                {row.canClear ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      void run({ action: "clear", kind: row.kind, id: row.id })
                    }
                  >
                    {t("library.expiry.clear")}
                  </Button>
                ) : null}
              </div>
              <form
                className="mt-3 grid gap-3 md:grid-cols-3"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const body = Object.fromEntries(new FormData(form).entries());
                  void run({
                    action: "set",
                    kind: row.kind,
                    id: row.id,
                    expiresAt: body.expiresAt,
                  });
                  form.reset();
                }}
              >
                <input name="expiresAt" type="date" required className={fieldClass} />
                <Button type="submit" disabled={pending}>
                  {t("library.expiry.set")}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm font-semibold text-muted">{t("library.expiry.none")}</p>
      )}

      {error ? <p className="mt-4 text-sm font-semibold text-brand">{error}</p> : null}
      {message ? <p className="mt-4 text-sm font-semibold text-brand">{message}</p> : null}
    </section>
  );
}
