"use client";

import { useT } from "@/components/i18n/i18n-provider";
import type { UiMessageKey } from "@/lib/i18n";
import type { PresenceKind } from "@/lib/presence";
import type { PresenceDesk, PresenceProfile } from "@/server/lms/presence";

const kindKeys: Record<PresenceKind, UiMessageKey> = {
  login: "activity.kind.login",
  logout: "activity.kind.logout",
  lesson_enter: "activity.kind.lesson_enter",
  lesson_exit: "activity.kind.lesson_exit",
};

function ActivityList({ profile }: { profile: PresenceProfile }) {
  const t = useT();
  return (
    <>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl bg-background px-4 py-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">
            {t("activity.logins")}
          </p>
          <p className="font-heading mt-2 text-3xl font-bold tracking-tight text-brand">
            {profile.summary.logins}
          </p>
        </article>
        <article className="rounded-2xl bg-background px-4 py-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">
            {t("activity.logouts")}
          </p>
          <p className="font-heading mt-2 text-3xl font-bold tracking-tight text-brand">
            {profile.summary.logouts}
          </p>
        </article>
        <article className="rounded-2xl bg-[#F3E6D0] px-4 py-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">
            {t("activity.enters")}
          </p>
          <p className="font-heading mt-2 text-3xl font-bold tracking-tight text-brand">
            {profile.summary.enters}
          </p>
        </article>
        <article className="rounded-2xl bg-background px-4 py-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">
            {t("activity.exits")}
          </p>
          <p className="font-heading mt-2 text-3xl font-bold tracking-tight text-brand">
            {profile.summary.exits}
          </p>
        </article>
      </div>
      {profile.events.length ? (
        <ol className="mt-5 grid gap-2">
          {profile.events.map((event) => (
            <li key={event.id} className="rounded-2xl bg-background px-4 py-3">
              <p className="font-heading font-bold tracking-tight text-brand">
                {t(kindKeys[event.kind])}
                {event.title ? ` · ${event.title}` : ""}
              </p>
              <p className="mt-1 text-sm text-muted">
                {new Date(event.at).toLocaleString()}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-muted">{t("activity.none.events")}</p>
      )}
    </>
  );
}

export function ActivityDeskView({ desk }: { desk: PresenceDesk }) {
  const t = useT();
  const profile = desk.profile;

  return (
    <div className="space-y-8">
      {desk.learners.length > 1 ? (
        <p className="text-sm font-semibold">
          {t("activity.choose")}
          {": "}
          {desk.learners.map((learner, index) => (
            <span key={learner.studentUserId}>
              {index ? " · " : null}
              <a href={learner.href} className="text-brand underline">
                {learner.name}
              </a>
            </span>
          ))}
        </p>
      ) : null}

      {desk.own ? (
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
            {t("activity.yours")}
          </p>
          <h2 className="font-heading mt-2 text-3xl font-bold tracking-tight text-brand">
            {t("activity.for", { name: desk.own.studentName })}
          </h2>
          <ActivityList profile={desk.own} />
        </section>
      ) : null}

      {profile ? (
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#CB9F64]">
            {t("activity.for", { name: profile.studentName })}
          </p>
          <h2 className="font-heading mt-2 text-3xl font-bold tracking-tight text-brand">
            {t("activity.timeline")}
          </h2>
          <ActivityList profile={profile} />
        </section>
      ) : (
        <p className="rounded-[2rem] border border-line bg-surface px-5 py-4 text-sm text-muted">
          {desk.learners.length ? t("activity.pick") : t("activity.none.learners")}
        </p>
      )}
    </div>
  );
}
