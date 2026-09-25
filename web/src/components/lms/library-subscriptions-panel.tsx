"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass, postJson } from "@/lib/api";
import type { LibrarySubscriptionDesk } from "@/server/lms/subscriptions";

export function LibrarySubscriptionsPanel({
  initial,
}: {
  initial: LibrarySubscriptionDesk;
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
      const next = await postJson<LibrarySubscriptionDesk>(
        "/api/v1/library/subscriptions",
        body,
      );
      setDesk(next);
      setMessage(t("library.subscription.saved"));
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
    await run({ action: "create_plan", ...body });
    form.reset();
  }

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
        {t("library.subscription.title")}
      </h2>
      <p className="mt-2 text-sm font-semibold text-muted">
        {t("library.subscription.help")}
      </p>

      <form className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4" onSubmit={onCreate}>
        <input name="key" required placeholder={t("library.subscription.key")} className={fieldClass} />
        <input name="name" required placeholder={t("library.subscription.name")} className={fieldClass} />
        <input
          name="defaultDays"
          type="number"
          min={1}
          placeholder={t("library.subscription.default_days")}
          className={fieldClass}
        />
        <Button type="submit" disabled={pending}>
          {t("library.subscription.create")}
        </Button>
      </form>

      {desk.plans.length ? (
        <ul className="mt-6 grid gap-4">
          {desk.plans.map((plan) => (
            <li key={plan.key} className="rounded-2xl bg-background px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-heading font-bold tracking-tight text-brand">
                    {plan.name}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-muted">
                    {t("library.subscription.subscribers", { count: plan.subscriberCount })}
                    {plan.defaultDays
                      ? ` · ${t("library.subscription.days", { count: plan.defaultDays })}`
                      : ""}
                    {` · ${plan.isEnabled ? t("library.subscription.enabled") : t("library.subscription.disabled")}`}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    void run({
                      action: "update_plan",
                      key: plan.key,
                      isEnabled: !plan.isEnabled,
                    })
                  }
                >
                  {plan.isEnabled
                    ? t("library.subscription.disable")
                    : t("library.subscription.enable")}
                </Button>
              </div>

              <form
                className="mt-4 grid gap-3 md:grid-cols-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void run({
                    action: "attach_material",
                    planKey: plan.key,
                    materialId: String(form.get("materialId") ?? ""),
                  });
                }}
              >
                <select name="materialId" required className={fieldClass} defaultValue="">
                  <option value="">{t("library.subscription.cover")}</option>
                  {desk.materials
                    .filter((item) => !plan.materials.some((covered) => covered.id === item.id))
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                </select>
                <Button type="submit" disabled={pending}>
                  {t("library.subscription.attach")}
                </Button>
              </form>
              {plan.materials.length ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {plan.materials.map((item) => (
                    <li key={item.id}>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() =>
                          void run({
                            action: "detach_material",
                            planKey: plan.key,
                            materialId: item.id,
                          })
                        }
                      >
                        {item.title} · {t("library.subscription.detach")}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm font-semibold text-muted">
                  {t("library.subscription.no_materials")}
                </p>
              )}

              <form
                className="mt-4 grid gap-3 md:grid-cols-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const body = Object.fromEntries(new FormData(form).entries());
                  void run({
                    action: "assign",
                    planKey: plan.key,
                    email: body.email,
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
                <input name="expiresAt" type="date" className={fieldClass} />
                <Button type="submit" disabled={pending}>
                  {t("library.subscription.assign")}
                </Button>
              </form>
              {plan.subscriptions.length ? (
                <ul className="mt-3 grid gap-2">
                  {plan.subscriptions.map((seat) => (
                    <li
                      key={seat.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-brand"
                    >
                      <span>
                        {seat.studentName}
                        {seat.expiresAt
                          ? ` · ${t("library.access.grant_expires")} ${seat.expiresAt.slice(0, 10)}`
                          : ` · ${t("library.subscription.open_ended")}`}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={pending}
                          onClick={() =>
                            void run({
                              action: "extend",
                              subscriptionId: seat.id,
                              days: 30,
                            })
                          }
                        >
                          {t("library.subscription.extend")}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={pending}
                          onClick={() =>
                            void run({ action: "end", subscriptionId: seat.id })
                          }
                        >
                          {t("library.subscription.end")}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm font-semibold text-muted">
                  {t("library.subscription.none_assigned")}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm font-semibold text-muted">{t("library.subscription.none")}</p>
      )}

      {error ? <p className="mt-4 text-sm font-semibold text-brand">{error}</p> : null}
      {message ? <p className="mt-4 text-sm font-semibold text-brand">{message}</p> : null}
    </section>
  );
}
