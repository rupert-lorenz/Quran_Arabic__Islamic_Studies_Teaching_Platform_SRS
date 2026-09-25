"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass, postJson } from "@/lib/api";
import type { LibraryLicenceDesk } from "@/server/lms/licences";

export function LibraryLicencesPanel({
  initial,
}: {
  initial: LibraryLicenceDesk;
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
      const next = await postJson<LibraryLicenceDesk>(
        "/api/v1/library/licences",
        body,
      );
      setDesk(next);
      setMessage(t("library.licence.saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("library.failed"));
    } finally {
      setPending(false);
    }
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    await run({ action: "create_pool", ...body });
    form.reset();
  }

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
        {t("library.licence.title")}
      </h2>
      <p className="mt-2 text-sm font-semibold text-muted">
        {t("library.licence.help")}
      </p>

      <form className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-5" onSubmit={onCreate}>
        <input name="key" required placeholder={t("library.licence.key")} className={fieldClass} />
        <input name="name" required placeholder={t("library.licence.name")} className={fieldClass} />
        <input name="seatLimit" type="number" min={1} placeholder={t("library.licence.seat_limit")} className={fieldClass} />
        <input name="defaultDays" type="number" min={1} placeholder={t("library.licence.default_days")} className={fieldClass} />
        <Button type="submit" disabled={pending}>
          {t("library.licence.create")}
        </Button>
      </form>

      {desk.pools.length ? (
        <ul className="mt-6 grid gap-4">
          {desk.pools.map((pool) => (
            <li key={pool.key} className="rounded-2xl bg-background px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-heading font-bold tracking-tight text-brand">
                    {pool.name}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-muted">
                    {t("library.licence.seats_used", {
                      used: pool.usedSeats,
                      limit: pool.seatLimit ?? t("library.licence.unlimited"),
                    })}
                    {pool.defaultDays
                      ? ` · ${t("library.licence.days", { count: pool.defaultDays })}`
                      : ""}
                    {` · ${pool.isEnabled ? t("library.licence.enabled") : t("library.licence.disabled")}`}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    void run({
                      action: "update_pool",
                      key: pool.key,
                      isEnabled: !pool.isEnabled,
                    })
                  }
                >
                  {pool.isEnabled
                    ? t("library.licence.disable")
                    : t("library.licence.enable")}
                </Button>
              </div>

              <form
                className="mt-4 grid gap-3 md:grid-cols-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void run({
                    action: "attach_material",
                    poolKey: pool.key,
                    materialId: String(form.get("materialId") ?? ""),
                  });
                }}
              >
                <select name="materialId" required className={fieldClass} defaultValue="">
                  <option value="">{t("library.licence.cover")}</option>
                  {desk.materials
                    .filter((item) => !pool.materials.some((covered) => covered.id === item.id))
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                </select>
                <Button type="submit" disabled={pending}>
                  {t("library.licence.attach")}
                </Button>
              </form>
              {pool.materials.length ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {pool.materials.map((item) => (
                    <li key={item.id}>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() =>
                          void run({
                            action: "detach_material",
                            poolKey: pool.key,
                            materialId: item.id,
                          })
                        }
                      >
                        {item.title} · {t("library.licence.detach")}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm font-semibold text-muted">
                  {t("library.licence.no_materials")}
                </p>
              )}

              <form
                className="mt-4 grid gap-3 md:grid-cols-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const body = Object.fromEntries(new FormData(form).entries());
                  void run({
                    action: "assign_seat",
                    poolKey: pool.key,
                    email: body.email,
                    materialId: body.materialId || undefined,
                    expiresAt: body.expiresAt || undefined,
                  });
                  form.reset();
                }}
              >
                <input
                  name="email"
                  type="email"
                  required
                  placeholder={t("library.access.student_email")}
                  className={fieldClass}
                />
                <select name="materialId" className={fieldClass} defaultValue="">
                  <option value="">{t("library.licence.whole_pool")}</option>
                  {pool.materials.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
                <input name="expiresAt" type="date" className={fieldClass} />
                <Button type="submit" disabled={pending}>
                  {t("library.licence.assign")}
                </Button>
              </form>
              {pool.seats.length ? (
                <ul className="mt-3 grid gap-2">
                  {pool.seats.map((seat) => (
                    <li
                      key={seat.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-brand"
                    >
                      <span>
                        {seat.studentName}
                        {` · ${seat.materialTitle ?? t("library.licence.whole_pool")}`}
                        {seat.expiresAt
                          ? ` · ${t("library.access.grant_expires")} ${seat.expiresAt.slice(0, 10)}`
                          : ""}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => void run({ action: "revoke_seat", seatId: seat.id })}
                      >
                        {t("library.licence.revoke")}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm font-semibold text-muted">
                  {t("library.licence.no_seats")}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm font-semibold text-muted">{t("library.licence.none")}</p>
      )}

      {error ? <p className="mt-4 text-sm font-semibold text-brand">{error}</p> : null}
      {message ? <p className="mt-4 text-sm font-semibold text-brand">{message}</p> : null}
    </section>
  );
}
