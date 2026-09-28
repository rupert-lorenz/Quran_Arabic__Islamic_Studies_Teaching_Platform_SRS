"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { fieldClass, postJson } from "@/lib/api";
import type { UiMessageKey } from "@/lib/i18n";
import type { GroupOpportunityView } from "@/server/booking/group-class-opportunities";

export function TeacherGroupOpportunityBoard({
  initial,
}: {
  initial: GroupOpportunityView[];
}) {
  const t = useT();
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");

  async function apply(id: string, bidMajor: string, message: string) {
    setPending(`apply:${id}`);
    setError("");
    try {
      const updated = await postJson<GroupOpportunityView>(
        `/api/v1/teacher/group-class-opportunities/${id}/apply`,
        {
          ...(bidMajor.trim() ? { bidMajor: Number(bidMajor) } : {}),
          ...(message.trim() ? { message } : {}),
        },
      );
      setItems((current) =>
        current.map((item) => (item.id === id ? updated : item)),
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("group.apply_failed"));
    } finally {
      setPending("");
    }
  }

  async function withdraw(id: string) {
    setPending(`withdraw:${id}`);
    setError("");
    try {
      const updated = await postJson<GroupOpportunityView>(
        `/api/v1/teacher/group-class-opportunities/${id}/withdraw`,
        {},
      );
      setItems((current) =>
        current.map((item) => (item.id === id ? updated : item)),
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("group.withdraw_failed"));
    } finally {
      setPending("");
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-extrabold text-brand">
          {t("group.opportunities")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          {t("group.opportunities_help")}
        </p>
      </div>
      {error ? (
        <p className="rounded-2xl bg-rose px-4 py-3 text-sm font-semibold tracking-normal text-brand whitespace-normal">
          {error}
        </p>
      ) : null}
      {items.length ? (
        items.map((item) => (
          <article
            key={item.id}
            className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
          >
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              {t("group.opportunity_badge")}
            </p>
            <h3 className="mt-1 text-xl font-extrabold text-brand">{item.title}</h3>
            <p className="mt-1 text-sm text-muted">
              {item.subjectName}
              {item.scheduleLabel ? ` · ${item.scheduleLabel}` : ""}
            </p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-background px-4 py-3">
                <dt className="font-bold text-muted">{t("group.when")}</dt>
                <dd className="font-extrabold text-brand">{item.whenLabel}</dd>
              </div>
              <div className="rounded-2xl bg-background px-4 py-3">
                <dt className="font-bold text-muted">{t("group.length")}</dt>
                <dd className="font-extrabold text-brand">
                  {item.durationMinutes} {t("booking.minutes")}
                </dd>
              </div>
              <div className="rounded-2xl bg-background px-4 py-3">
                <dt className="font-bold text-muted">{t("group.level")}</dt>
                <dd className="font-extrabold text-brand">
                  {t(`group.level_${item.level}` as UiMessageKey)}
                </dd>
              </div>
              <div className="rounded-2xl bg-background px-4 py-3">
                <dt className="font-bold text-muted">{t("group.capacity")}</dt>
                <dd className="font-extrabold text-brand">
                  {item.capacity} · {t("group.minimum_students", { min: item.minStudents })}
                </dd>
              </div>
              <div className="rounded-2xl bg-background px-4 py-3">
                <dt className="font-bold text-muted">{t("group.teacher_payment")}</dt>
                <dd className="font-extrabold text-brand">
                  {t("group.teacher_payment_per_session", {
                    price: item.teacherPaymentFormatted,
                  })}
                </dd>
                {item.sessionCount > 1 ? (
                  <dd className="mt-1 text-xs font-semibold text-muted">
                    {t("group.teacher_payment_series", {
                      sessions: item.sessionCount,
                      total: item.teacherPaymentSeriesFormatted,
                    })}
                  </dd>
                ) : null}
              </div>
              {item.applicationDeadlineLabel ? (
                <div className="rounded-2xl bg-background px-4 py-3">
                  <dt className="font-bold text-muted">{t("group.apply_by")}</dt>
                  <dd className="font-extrabold text-brand">
                    {t("group.applications_open_until", {
                      when: item.applicationDeadlineLabel,
                    })}
                  </dd>
                </div>
              ) : null}
            </dl>
            {item.description ? (
              <p className="mt-4 text-sm text-muted">{item.description}</p>
            ) : null}
            {item.myApplication?.status === "accepted" ? (
              <p className="mt-5 rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-brand">
                {t("group.application_accepted")}
                {item.myApplication.bidFormatted
                  ? ` · ${t("group.your_bid", { price: item.myApplication.bidFormatted })}`
                  : ""}
              </p>
            ) : item.myApplication?.status === "rejected" ? (
              <p className="mt-5 rounded-2xl bg-gold px-4 py-3 text-sm font-semibold text-brand">
                {t("group.application_rejected")}
              </p>
            ) : item.myApplication?.status === "pending" ? (
              <div className="mt-5 space-y-3">
                <p className="rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-brand">
                  {t("group.applied")}
                  {item.myApplication.bidFormatted
                    ? ` · ${t("group.your_bid", { price: item.myApplication.bidFormatted })}`
                    : ""}
                </p>
                <Button
                  variant="secondary"
                  disabled={pending === `withdraw:${item.id}`}
                  onClick={() => withdraw(item.id)}
                >
                  {pending === `withdraw:${item.id}`
                    ? t("group.withdrawing")
                    : t("group.withdraw_application")}
                </Button>
              </div>
            ) : item.canApply ? (
              <form
                className="mt-5 space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = new FormData(event.currentTarget);
                  void apply(
                    item.id,
                    String(form.get("bidMajor") ?? ""),
                    String(form.get("message") ?? ""),
                  );
                }}
              >
                <label className="block">
                  <span className="mb-1 block text-sm font-bold text-brand">
                    {t("group.bid_label")}
                  </span>
                  <input
                    name="bidMajor"
                    type="number"
                    min={0}
                    step="0.01"
                    className={fieldClass}
                    placeholder={item.teacherPaymentFormatted}
                  />
                  <span className="mt-1 block text-xs font-semibold text-muted">
                    {t("group.bid_help")}
                  </span>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-bold text-brand">
                    {t("group.application_message")}
                  </span>
                  <textarea name="message" rows={3} maxLength={1000} className={fieldClass} />
                </label>
                <Button disabled={pending === `apply:${item.id}`}>
                  {pending === `apply:${item.id}`
                    ? t("group.applying")
                    : t("group.apply_opportunity")}
                </Button>
              </form>
            ) : (
              <p className="mt-5 text-sm font-semibold text-muted">
                {item.cannotApplyReason ?? t("group.applications_closed")}
              </p>
            )}
          </article>
        ))
      ) : (
        <p className="rounded-2xl bg-gold px-5 py-4 font-semibold text-brand">
          {t("group.opportunity_empty")}
        </p>
      )}
    </section>
  );
}
