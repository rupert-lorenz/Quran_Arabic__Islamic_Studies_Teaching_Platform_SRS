"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass, postJson } from "@/lib/api";
import type { LibraryRentalDesk } from "@/server/lms/rentals";

export function LibraryRentalsPanel({
  initial,
}: {
  initial: LibraryRentalDesk;
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
      const next = await postJson<LibraryRentalDesk>(
        "/api/v1/library/rentals",
        body,
      );
      setDesk(next);
      setMessage(t("library.rental.saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("library.failed"));
    } finally {
      setPending(false);
    }
  }

  async function onSetDays(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    await run({ action: "set_days", ...body });
    form.reset();
  }

  async function onAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    await run({ action: "assign", ...body });
    form.reset();
  }

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
        {t("library.rental.title")}
      </h2>
      <p className="mt-2 text-sm font-semibold text-muted">
        {t("library.rental.help")}
      </p>

      <form className="mt-6 grid gap-3 md:grid-cols-3" onSubmit={onSetDays}>
        <select name="materialId" required className={fieldClass} defaultValue="">
          <option value="">{t("library.rental.material")}</option>
          {desk.materials.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
              {item.rentalDays
                ? ` · ${t("library.rental.days", { count: item.rentalDays })}`
                : ""}
            </option>
          ))}
        </select>
        <input
          name="rentalDays"
          type="number"
          min={1}
          placeholder={t("library.rental.default_days")}
          className={fieldClass}
        />
        <Button type="submit" disabled={pending}>
          {t("library.rental.set_days")}
        </Button>
      </form>

      <form className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5" onSubmit={onAssign}>
        <input
          name="email"
          type="email"
          required
          placeholder={t("library.access.student_email")}
          className={fieldClass}
        />
        <select name="materialId" required className={fieldClass} defaultValue="">
          <option value="">{t("library.rental.material")}</option>
          {desk.materials.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
        <input
          name="days"
          type="number"
          min={1}
          placeholder={t("library.rental.days_label")}
          className={fieldClass}
        />
        <input name="startsAt" type="date" className={fieldClass} />
        <input name="expiresAt" type="date" className={fieldClass} />
        <Button type="submit" disabled={pending} className="lg:col-span-5">
          {t("library.rental.assign")}
        </Button>
      </form>

      {error ? <p className="mt-4 text-sm font-semibold text-red-700">{error}</p> : null}
      {message ? <p className="mt-4 text-sm font-semibold text-brand">{message}</p> : null}

      {desk.rentals.length ? (
        <ul className="mt-6 grid gap-3">
          {desk.rentals.map((rental) => (
            <li
              key={rental.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background px-4 py-3"
            >
              <p className="text-sm font-semibold text-muted">
                {rental.studentName}
                {` · ${rental.materialTitle}`}
                {rental.status === "upcoming"
                  ? ` · ${t("library.rental.starts")} ${rental.startsAt.slice(0, 10)}`
                  : ""}
                {rental.status === "ended"
                  ? ` · ${t("library.rental.ended")} ${rental.expiresAt.slice(0, 10)}`
                  : ` · ${t("library.access.grant_expires")} ${rental.expiresAt.slice(0, 10)}`}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    run({
                      action: "extend",
                      rentalId: rental.id,
                      days: 7,
                    })
                  }
                >
                  {t("library.rental.extend")}
                </Button>
                {rental.status !== "ended" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => run({ action: "end", rentalId: rental.id })}
                  >
                    {t("library.rental.end")}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm font-semibold text-muted">{t("library.rental.none")}</p>
      )}
    </section>
  );
}
