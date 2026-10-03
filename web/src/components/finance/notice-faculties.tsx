"use client";

import { useState } from "react";
import { useT } from "@/components/i18n/i18n-provider";
import { LedgerFacultyView } from "@/components/finance/ledger-faculty";
import { Button } from "@/components/ui/button";
import { fieldClass, patchJson } from "@/lib/api";
import { REMINDER_LEAD_HOURS, type ReminderLeadHour } from "@/lib/communications";
import type { UiMessageKey } from "@/lib/i18n";
import type { getNoticeFaculties } from "@/server/finance/notice-faculties";

type Notices = Awaited<ReturnType<typeof getNoticeFaculties>>;
type Quality = Notices["quality"];

const templateKeys: Record<string, UiMessageKey> = {
  verify_email: "templates.key.verify_email",
  password_reset: "templates.key.password_reset",
  booking_confirmed: "templates.key.booking_confirmed",
  lesson_reminder: "templates.key.lesson_reminder",
};

export function NoticeFacultiesView({
  notices,
  role,
}: {
  notices: Notices;
  role: "staff" | "teacher" | "parent";
}) {
  const t = useT();
  const [reminders, setReminders] = useState(notices.reminders);
  const [templates, setTemplates] = useState(notices.templates.items);
  const bookingsHref =
    role === "staff" ? "/staff/bookings" : role === "teacher" ? "/teach/bookings" : "/family/bookings";

  return (
    <>
      <LedgerFacultyView
        titleKey="guard.faculty.title"
        helpKey="guard.faculty.help"
        manageKey="guard.faculty.manage"
        emptyKey="guard.faculty.empty"
        manageHref="/messages"
        tiles={[
          { labelKey: "guard.faculty.channels", value: notices.contactGuard.channels },
          { labelKey: "guard.faculty.flags", value: notices.contactGuard.flags },
          { labelKey: "guard.faculty.classroom", value: notices.contactFlags.classroom },
          { labelKey: "guard.faculty.messages", value: notices.contactFlags.messages },
        ]}
        rows={notices.contactGuard.recent}
      />
      <LedgerFacultyView
        titleKey="flags.faculty.title"
        helpKey="flags.faculty.help"
        manageKey="flags.faculty.manage"
        emptyKey="flags.faculty.empty"
        manageHref={role === "staff" ? "/staff/safeguarding" : null}
        tiles={[
          { labelKey: "flags.faculty.total", value: notices.contactFlags.total },
          { labelKey: "flags.faculty.classroom", value: notices.contactFlags.classroom },
          { labelKey: "flags.faculty.whiteboard", value: notices.contactFlags.whiteboard },
          { labelKey: "flags.faculty.files", value: notices.contactFlags.files },
        ]}
        rows={notices.contactFlags.recent}
      />
      <LedgerFacultyView
        titleKey="email.faculty.title"
        helpKey="email.faculty.help"
        manageKey="email.faculty.manage"
        emptyKey="email.faculty.empty"
        manageHref={null}
        tiles={[
          {
            labelKey: "email.faculty.adapter",
            value: notices.email.configured ? t("email.faculty.on") : t("email.faculty.off"),
          },
          { labelKey: "email.faculty.composed", value: notices.email.composed },
          { labelKey: "email.faculty.delivered", value: notices.email.delivered },
          { labelKey: "templates.faculty.count", value: templates.length },
        ]}
        rows={notices.email.recent}
      />
      <LedgerFacultyView
        titleKey="inbox.faculty.title"
        helpKey="inbox.faculty.help"
        manageKey="inbox.faculty.manage"
        emptyKey="inbox.faculty.empty"
        manageHref={null}
        tiles={[
          { labelKey: "inbox.faculty.total", value: notices.inbox.total },
          { labelKey: "inbox.faculty.unread", value: notices.inbox.unread },
          { labelKey: "inbox.faculty.read", value: notices.inbox.read },
          { labelKey: "reminders.faculty.sent", value: notices.reminders.sent },
        ]}
        rows={notices.inbox.recent}
      />
      <LedgerFacultyView
        titleKey="push.faculty.title"
        helpKey="push.faculty.help"
        manageKey="push.faculty.manage"
        emptyKey="push.faculty.empty"
        hideEmpty
        manageHref={null}
        tiles={[
          { labelKey: "push.faculty.connected", value: t("push.faculty.off") },
          { labelKey: "push.faculty.devices", value: notices.push.devices },
          { labelKey: "push.faculty.sent", value: notices.push.sent },
          { labelKey: "whatsapp.faculty.permitted", value: t("whatsapp.faculty.no") },
        ]}
        rows={[]}
      />
      <LedgerFacultyView
        titleKey="sms.faculty.title"
        helpKey="sms.faculty.help"
        manageKey="sms.faculty.manage"
        emptyKey="sms.faculty.empty"
        hideEmpty
        manageHref={null}
        tiles={[
          { labelKey: "sms.faculty.connected", value: t("sms.faculty.off") },
          { labelKey: "sms.faculty.queued", value: notices.sms.queued },
          { labelKey: "sms.faculty.sent", value: notices.sms.sent },
          { labelKey: "email.faculty.delivered", value: 0 },
        ]}
        rows={[]}
      />
      <LedgerFacultyView
        titleKey="whatsapp.faculty.title"
        helpKey="whatsapp.faculty.help"
        manageKey="whatsapp.faculty.manage"
        emptyKey="whatsapp.faculty.empty"
        hideEmpty
        manageHref={null}
        tiles={[
          { labelKey: "whatsapp.faculty.connected", value: t("whatsapp.faculty.off") },
          { labelKey: "whatsapp.faculty.permitted", value: t("whatsapp.faculty.no") },
          { labelKey: "whatsapp.faculty.sent", value: notices.whatsapp.sent },
          { labelKey: "sms.faculty.queued", value: 0 },
        ]}
        rows={[]}
      />
      <LedgerFacultyView
        titleKey="reminders.faculty.title"
        helpKey="reminders.faculty.help"
        manageKey="reminders.faculty.manage"
        emptyKey="reminders.faculty.empty"
        manageHref={bookingsHref}
        tiles={[
          {
            labelKey: "reminders.faculty.status",
            value: reminders.enabled ? t("reminders.faculty.on") : t("reminders.faculty.off"),
          },
          { labelKey: "reminders.faculty.leads", value: reminders.leadLabel },
          { labelKey: "reminders.faculty.upcoming", value: reminders.due },
          { labelKey: "reminders.faculty.sent", value: reminders.sent },
        ]}
        rows={reminders.recent}
      />
      {reminders.canEdit ? (
        <ReminderEditor
          enabled={reminders.enabled}
          leadHours={reminders.leadHours}
          onSaved={(next) =>
            setReminders((current) => ({
              ...current,
              enabled: next.enabled,
              leadHours: next.leadHours.filter((hours): hours is ReminderLeadHour =>
                (REMINDER_LEAD_HOURS as readonly number[]).includes(hours),
              ),
              leadLabel: next.leadHours.map((hours) => `${hours}h`).join(", "),
            }))
          }
        />
      ) : null}
      <LedgerFacultyView
        titleKey="templates.faculty.title"
        helpKey="templates.faculty.help"
        manageKey="templates.faculty.manage"
        emptyKey="templates.faculty.empty"
        manageHref={null}
        tiles={[
          { labelKey: "templates.faculty.count", value: templates.length },
          { labelKey: "templates.faculty.tokens", value: "{{name}} {{when}} {{link}}" },
          {
            labelKey: "templates.faculty.delivery",
            value: notices.email.configured ? t("email.faculty.on") : t("templates.faculty.off"),
          },
          { labelKey: "email.faculty.delivered", value: notices.email.delivered },
        ]}
        rows={templates.map((item) => ({
          id: item.key,
          title: t(templateKeys[item.key] ?? "templates.key.lesson_reminder"),
          meta: `${item.subject} · ${item.body}`,
        }))}
      />
      {notices.templates.canEdit ? (
        <TemplateEditor
          items={templates}
          onSaved={(key, subject, body) =>
            setTemplates((current) =>
              current.map((item) => (item.key === key ? { ...item, subject, body } : item)),
            )
          }
        />
      ) : null}
      <QualityFacultyView quality={notices.quality} staff={role === "staff"} />
    </>
  );
}

export function QualityFacultyView({
  quality,
  staff,
}: {
  quality: Quality;
  staff: boolean;
}) {
  const t = useT();
  return (
    <LedgerFacultyView
      titleKey="quality.faculty.title"
      helpKey="quality.faculty.help"
      manageKey="quality.faculty.manage"
      extraKey="quality.faculty.safeguarding"
      emptyKey="quality.faculty.empty"
      manageHref={staff ? "/staff/reviews" : null}
      extraHref={staff && quality.reports !== null ? "/staff/safeguarding" : null}
      tiles={[
        { labelKey: "quality.faculty.pending", value: quality.pending },
        { labelKey: "quality.faculty.published", value: quality.published },
        { labelKey: "quality.faculty.hidden", value: quality.hidden },
        {
          labelKey: "quality.faculty.reports",
          value: quality.reports === null ? t("quality.faculty.restricted") : quality.reports,
        },
      ]}
      rows={quality.recent}
    />
  );
}

function ReminderEditor({
  enabled,
  leadHours,
  onSaved,
}: {
  enabled: boolean;
  leadHours: number[];
  onSaved: (next: { enabled: boolean; leadHours: number[] }) => void;
}) {
  const t = useT();
  const [on, setOn] = useState(enabled);
  const [first, setFirst] = useState(String(leadHours[0] ?? 24));
  const [second, setSecond] = useState(leadHours[1] ? String(leadHours[1]) : "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <form
      className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setMessage("");
        const lead = [...new Set([Number(first), ...(second ? [Number(second)] : [])])];
        try {
          const next = await patchJson<{ enabled: boolean; leadHours: number[] }>(
            "/api/v1/staff/communications/reminders",
            { enabled: on, leadHours: lead },
          );
          onSaved(next);
          setMessage(t("reminders.faculty.saved"));
        } catch (error) {
          setMessage(error instanceof Error ? error.message : t("reminders.faculty.failed"));
        } finally {
          setPending(false);
        }
      }}
    >
      <h3 className="font-heading text-lg font-bold tracking-tight text-brand">
        {t("reminders.faculty.title")}
      </h3>
      <label className="mt-4 flex items-center gap-2 text-sm font-bold text-brand">
        <input
          type="checkbox"
          checked={on}
          onChange={(event) => setOn(event.target.checked)}
        />
        {t("reminders.faculty.enabled")}
      </label>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">
            {t("reminders.faculty.first")}
          </span>
          <select
            className={fieldClass}
            value={first}
            onChange={(event) => setFirst(event.target.value)}
          >
            {REMINDER_LEAD_HOURS.map((hours) => (
              <option key={hours} value={hours}>
                {hours}h
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-brand">
            {t("reminders.faculty.second")}
          </span>
          <select
            className={fieldClass}
            value={second}
            onChange={(event) => setSecond(event.target.value)}
          >
            <option value="">{t("reminders.faculty.none")}</option>
            {REMINDER_LEAD_HOURS.map((hours) => (
              <option key={hours} value={hours}>
                {hours}h
              </option>
            ))}
          </select>
        </label>
      </div>
      <Button className="mt-4" type="submit" disabled={pending}>
        {pending ? t("reminders.faculty.saving") : t("reminders.faculty.save")}
      </Button>
      {message ? <p className="mt-3 text-sm font-semibold text-brand">{message}</p> : null}
    </form>
  );
}

function TemplateEditor({
  items,
  onSaved,
}: {
  items: Notices["templates"]["items"];
  onSaved: (key: string, subject: string, body: string) => void;
}) {
  const t = useT();
  const [key, setKey] = useState(items[0]?.key ?? "lesson_reminder");
  const current = items.find((item) => item.key === key) ?? items[0];
  const [subject, setSubject] = useState(current?.subject ?? "");
  const [body, setBody] = useState(current?.body ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <form
      className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setMessage("");
        try {
          await patchJson("/api/v1/staff/communications/templates", {
            key,
            subject,
            body,
          });
          onSaved(key, subject, body);
          setMessage(t("templates.faculty.saved"));
        } catch (error) {
          setMessage(error instanceof Error ? error.message : t("templates.faculty.failed"));
        } finally {
          setPending(false);
        }
      }}
    >
      <h3 className="font-heading text-lg font-bold tracking-tight text-brand">
        {t("templates.faculty.title")}
      </h3>
      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-bold text-brand">
          {t("templates.faculty.key")}
        </span>
        <select
          className={fieldClass}
          value={key}
          onChange={(event) => {
            const nextKey = event.target.value;
            const next = items.find((item) => item.key === nextKey);
            setKey(nextKey as Notices["templates"]["items"][number]["key"]);
            setSubject(next?.subject ?? "");
            setBody(next?.body ?? "");
            setMessage("");
          }}
        >
          {items.map((item) => (
            <option key={item.key} value={item.key}>
              {t(templateKeys[item.key] ?? "templates.key.lesson_reminder")}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-bold text-brand">
          {t("templates.faculty.subject")}
        </span>
        <input
          className={fieldClass}
          value={subject}
          maxLength={120}
          required
          onChange={(event) => setSubject(event.target.value)}
        />
      </label>
      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-bold text-brand">
          {t("templates.faculty.body")}
        </span>
        <textarea
          className={fieldClass}
          value={body}
          maxLength={500}
          required
          rows={4}
          onChange={(event) => setBody(event.target.value)}
        />
      </label>
      <Button className="mt-4" type="submit" disabled={pending}>
        {pending ? t("templates.faculty.saving") : t("templates.faculty.save")}
      </Button>
      {message ? <p className="mt-3 text-sm font-semibold text-brand">{message}</p> : null}
    </form>
  );
}
