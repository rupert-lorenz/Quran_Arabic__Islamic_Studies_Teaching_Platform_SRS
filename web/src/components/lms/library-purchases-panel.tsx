"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { LibraryExpiryLabel } from "@/components/lms/library-expiry-label";
import { fieldClass, postJson } from "@/lib/api";
import type { LibraryPurchaseDesk } from "@/server/lms/purchases";

export function LibraryPurchasesPanel({
  initial,
}: {
  initial: LibraryPurchaseDesk;
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
      const next = await postJson<LibraryPurchaseDesk>(
        "/api/v1/library/purchases",
        body,
      );
      setDesk(next);
      setMessage(t("library.purchase.saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("library.failed"));
    } finally {
      setPending(false);
    }
  }

  async function onMark(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());
    await run({
      action: "set_purchasable",
      materialId: body.materialId,
      isPurchasable: true,
    });
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
        {t("library.purchase.title")}
      </h2>
      <p className="mt-2 text-sm font-semibold text-muted">
        {t("library.purchase.help")}
      </p>

      <form className="mt-6 grid gap-3 md:grid-cols-3" onSubmit={onMark}>
        <select name="materialId" required className={fieldClass} defaultValue="">
          <option value="">{t("library.purchase.material")}</option>
          {desk.materials.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
              {item.isPurchasable ? ` · ${t("library.purchase.purchasable")}` : ""}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={pending} className="md:col-span-2">
          {t("library.purchase.mark")}
        </Button>
      </form>

      <form className="mt-4 grid gap-3 md:grid-cols-4" onSubmit={onAssign}>
        <input
          name="email"
          type="email"
          required
          placeholder={t("library.access.student_email")}
          className={fieldClass}
        />
        <select name="materialId" required className={fieldClass} defaultValue="">
          <option value="">{t("library.purchase.material")}</option>
          {desk.materials.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
        <input name="expiresAt" type="date" className={fieldClass} />
        <Button type="submit" disabled={pending}>
          {t("library.purchase.assign")}
        </Button>
      </form>

      {error ? <p className="mt-4 text-sm font-semibold text-red-700">{error}</p> : null}
      {message ? <p className="mt-4 text-sm font-semibold text-brand">{message}</p> : null}

      {desk.purchases.length ? (
        <ul className="mt-6 grid gap-3">
          {desk.purchases.map((purchase) => (
            <li
              key={purchase.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background px-4 py-3"
            >
              <p className="text-sm font-semibold text-muted">
                {purchase.studentName}
                {` · ${purchase.materialTitle}`}
                {` · ${t("library.purchase.owned")} ${purchase.purchasedAt.slice(0, 10)}`}
                {` · `}
                <LibraryExpiryLabel expiresAt={purchase.expiresAt} />
              </p>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => run({ action: "revoke", purchaseId: purchase.id })}
              >
                {t("library.purchase.revoke")}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm font-semibold text-muted">
          {t("library.purchase.none")}
        </p>
      )}
    </section>
  );
}
