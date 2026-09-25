"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass, postJson } from "@/lib/api";
import type { LibraryAccessCatalog } from "@/server/lms/entitlements";

export function LibraryEntitlementsCatalog({
  catalog,
  onCatalog,
}: {
  catalog: LibraryAccessCatalog;
  onCatalog: (next: LibraryAccessCatalog) => void;
}) {
  const t = useT();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(
    event: FormEvent<HTMLFormElement>,
    action: "create_plan" | "assign_subscription",
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    setPending(true);
    setError("");
    setMessage("");
    try {
      const next = await postJson<LibraryAccessCatalog | { assigned: true }>(
        "/api/v1/library/entitlements",
        { action, ...body },
      );
      if ("liveCourses" in next) onCatalog(next);
      form.reset();
      setMessage(t("library.access.grant_saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("library.failed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl bg-mint p-4">
      <h3 className="font-heading text-lg font-bold tracking-tight text-brand">
        {t("library.access.catalog")}
      </h3>
      <p className="mt-2 text-sm font-semibold text-muted">
        {t("library.access.help")}
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <form className="grid gap-3" onSubmit={(event) => submit(event, "create_plan")}>
          <p className="text-sm font-bold text-brand">{t("library.access.create_plan")}</p>
          <input name="key" required placeholder={t("library.access.plan_key")} className={fieldClass} />
          <input name="name" required placeholder={t("library.access.plan_name")} className={fieldClass} />
          <Button type="submit" disabled={pending}>
            {t("library.access.create_plan")}
          </Button>
        </form>
        <form className="grid gap-3" onSubmit={(event) => submit(event, "assign_subscription")}>
          <p className="text-sm font-bold text-brand">{t("library.access.assign_subscription")}</p>
          <input name="email" type="email" required placeholder={t("library.access.student_email")} className={fieldClass} />
          <select name="planKey" required className={fieldClass} defaultValue="">
            <option value="">{t("library.access.plans")}</option>
            {catalog.plans.map((plan) => (
              <option key={plan.key} value={plan.key}>
                {plan.name}
              </option>
            ))}
          </select>
          <input name="expiresAt" type="date" className={fieldClass} />
          <Button type="submit" disabled={pending}>
            {t("library.access.assign_subscription")}
          </Button>
        </form>
      </div>
      {error ? <p className="mt-3 text-sm font-semibold text-brand">{error}</p> : null}
      {message ? <p className="mt-3 text-sm font-semibold text-brand">{message}</p> : null}
    </section>
  );
}
