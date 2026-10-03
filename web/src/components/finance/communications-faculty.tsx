"use client";

import Link from "next/link";
import { useT } from "@/components/i18n/i18n-provider";
import type { CommunicationModuleId } from "@/lib/communications";
import type { UiMessageKey } from "@/lib/i18n";
import type { getCommunicationsFaculty } from "@/server/finance/communications";

type Faculty = Awaited<ReturnType<typeof getCommunicationsFaculty>>;

const titleKeys: Record<CommunicationModuleId, UiMessageKey> = {
  messages: "comm.module.messages",
  contact_guard: "comm.module.contact_guard",
  email: "comm.module.email",
  in_platform: "comm.module.in_platform",
  push: "comm.module.push",
  sms: "comm.module.sms",
  whatsapp: "comm.module.whatsapp",
  reminders: "comm.module.reminders",
  templates: "comm.module.templates",
};

const helpKeys: Record<CommunicationModuleId, UiMessageKey> = {
  messages: "comm.module.help.messages",
  contact_guard: "comm.module.help.contact_guard",
  email: "comm.module.help.email",
  in_platform: "comm.module.help.in_platform",
  push: "comm.module.help.push",
  sms: "comm.module.help.sms",
  whatsapp: "comm.module.help.whatsapp",
  reminders: "comm.module.help.reminders",
  templates: "comm.module.help.templates",
};

export function CommunicationsFacultyView({ faculty }: { faculty: Faculty }) {
  const t = useT();

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="font-heading text-xl font-bold tracking-tight text-brand">
        {t("comm.faculty.title")}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        {t("comm.faculty.help")}
      </p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("comm.faculty.notices")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{faculty.total}</dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("comm.faculty.unread")}
          </dt>
          <dd className="mt-1 font-bold text-brand">{faculty.unread}</dd>
        </div>
        <div className="rounded-2xl bg-mint px-4 py-3">
          <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-accent">
            {t("comm.faculty.email")}
          </dt>
          <dd className="mt-1 font-bold text-brand">
            {faculty.emailConfigured
              ? t("comm.faculty.email_on")
              : t("comm.faculty.email_off")}
          </dd>
        </div>
      </dl>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {faculty.modules.map((item) => (
          <article key={item.id} className="rounded-2xl border border-line px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-heading text-base font-bold tracking-tight text-brand">
                {t(titleKeys[item.id])}
              </h3>
              <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-extrabold text-brand">
                {item.live ? t("pay.live") : t("pay.planned")}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted">{t(helpKeys[item.id])}</p>
          </article>
        ))}
      </div>
      <Link
        href="/messages"
        className="mt-4 inline-block text-sm font-bold text-brand-accent underline"
      >
        {t("messages.open")}
      </Link>
      {faculty.recent.length ? (
        <ul className="mt-4 space-y-2">
          {faculty.recent.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-line px-4 py-3 text-sm"
            >
              <p className="font-bold text-brand">{row.title}</p>
              <p className="mt-1 text-muted">{row.meta}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted">{t("comm.faculty.empty")}</p>
      )}
    </section>
  );
}
