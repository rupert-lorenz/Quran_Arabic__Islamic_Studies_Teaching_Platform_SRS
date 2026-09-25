"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/api";
import type { GroupOpportunityView } from "@/server/booking/group-class-opportunities";

export function AdminGroupOpportunityBoard({
  initial,
}: {
  initial: GroupOpportunityView[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const initialKey = initial.map((row) => `${row.id}:${row.status}`).join("|");
  const [seenKey, setSeenKey] = useState(initialKey);
  if (seenKey !== initialKey) {
    setSeenKey(initialKey);
    setItems(initial);
  }
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");

  async function selectTeacher(opportunityId: string, applicationId: string) {
    setPending(`select:${applicationId}`);
    setError("");
    try {
      const updated = await postJson<GroupOpportunityView>(
        `/api/v1/staff/group-class-opportunities/${opportunityId}/select`,
        { applicationId },
      );
      setItems((current) =>
        current.map((item) => (item.id === opportunityId ? updated : item)),
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not select this teacher");
    } finally {
      setPending("");
    }
  }

  async function closeOpportunity(id: string) {
    setPending(id);
    setError("");
    try {
      const updated = await postJson<GroupOpportunityView>(
        `/api/v1/staff/group-class-opportunities/${id}/close`,
        {},
      );
      setItems((current) =>
        current.map((item) => (item.id === id ? updated : item)),
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not close this opportunity");
    } finally {
      setPending("");
    }
  }

  if (!items.length) {
    return (
      <p className="rounded-2xl bg-gold px-5 py-4 font-semibold text-brand">
        No group-class opportunities have been posted yet.
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-extrabold text-brand">Teacher applications</h2>
      {error ? (
        <p className="rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
      {items.map((item) => (
        <article
          key={item.id}
          className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                {item.status} · {item.applicationCount} pending
              </p>
              <h3 className="mt-1 text-xl font-extrabold text-brand">{item.title}</h3>
              <p className="mt-1 text-sm text-muted">
                {item.subjectName} · {item.whenLabel}
                {item.scheduleLabel ? ` · ${item.scheduleLabel}` : ""}
              </p>
              <p className="mt-2 text-sm font-semibold text-brand">
                Student {item.studentPriceFormatted}/session
                {item.sessionCount > 1 ? ` · ${item.seriesTotalFormatted} series` : ""}
                {" · "}
                listed teacher {item.teacherPaymentFormatted}/session
                {item.sessionCount > 1
                  ? ` · ${item.teacherPaymentSeriesFormatted} teacher series`
                  : ""}
              </p>
              {item.selectedTeacherName ? (
                <p className="mt-2 rounded-2xl bg-mint px-3 py-2 text-sm font-semibold text-brand">
                  Selected teacher: {item.selectedTeacherName}. The class is now
                  on their calendar for families to enrol.
                </p>
              ) : null}
              {item.applicationDeadlineLabel ? (
                <p className="mt-1 text-sm text-muted">
                  Apply by {item.applicationDeadlineLabel}
                </p>
              ) : null}
              {!item.isVisible && item.visibleFromLabel ? (
                <p className="mt-1 text-sm text-muted">
                  Hidden from teachers until {item.visibleFromLabel}
                </p>
              ) : null}
            </div>
            {item.status === "open" ? (
              <Button
                variant="secondary"
                disabled={pending === item.id}
                onClick={() => closeOpportunity(item.id)}
              >
                {pending === item.id ? "Closing…" : "Close applications"}
              </Button>
            ) : null}
          </div>
          {item.applications?.length ? (
            <ul className="mt-4 space-y-2">
              {item.applications.map((application) => (
                <li
                  key={application.id}
                  className="rounded-2xl bg-background px-4 py-3 text-sm"
                >
                  <p className="font-extrabold text-brand">
                    {application.teacherName} · {application.bidFormatted}/session
                    {" · "}
                    {application.status}
                  </p>
                  {application.message ? (
                    <p className="mt-1 text-muted">{application.message}</p>
                  ) : null}
                  {application.status === "pending" &&
                  (item.status === "open" || item.status === "closed") ? (
                    <Button
                      className="mt-3"
                      disabled={pending === `select:${application.id}`}
                      onClick={() => selectTeacher(item.id, application.id)}
                    >
                      {pending === `select:${application.id}`
                        ? "Selecting…"
                        : "Select this teacher"}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm font-semibold text-muted">
              No teacher applications yet.
            </p>
          )}
        </article>
      ))}
    </section>
  );
}
