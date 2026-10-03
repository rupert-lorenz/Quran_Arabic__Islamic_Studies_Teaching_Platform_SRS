"use client";

import { LedgerFacultyView } from "@/components/finance/ledger-faculty";
import { useT } from "@/components/i18n/i18n-provider";
import type { getMobileFaculties } from "@/server/mobile/faculties";

type Faculties = Awaited<ReturnType<typeof getMobileFaculties>>;

export function MobileFacultiesView({ faculties }: { faculties: Faculties }) {
  const t = useT();
  const links = faculties.links;

  return (
    <div className="space-y-8">
      <p className="max-w-2xl text-sm leading-6 text-muted">{t("mb.page.scope")}</p>
      <LedgerFacultyView
        titleKey="mb.ios.title"
        helpKey="mb.ios.help"
        tiles={[
          { labelKey: "mb.ios.project", value: t("mb.ios.ready") },
          { labelKey: "mb.ios.bundle", value: faculties.ios.bundleId },
          { labelKey: "mb.ios.store", value: t("mb.ios.notSubmitted") },
          {
            labelKey: "mb.ios.device",
            value: faculties.ios.registered
              ? t("mb.ios.registered")
              : t("mb.ios.missing"),
          },
        ]}
        rows={faculties.ios.rows}
        emptyKey="mb.ios.empty"
        hideEmpty={faculties.ios.rows.length === 0}
        manageHref={links.apps}
        manageKey="mb.open"
      />
      <LedgerFacultyView
        titleKey="mb.android.title"
        helpKey="mb.android.help"
        tiles={[
          { labelKey: "mb.android.project", value: t("mb.android.ready") },
          { labelKey: "mb.android.package", value: faculties.android.packageName },
          { labelKey: "mb.android.store", value: t("mb.android.notSubmitted") },
          {
            labelKey: "mb.android.device",
            value: faculties.android.registered
              ? t("mb.android.registered")
              : t("mb.android.missing"),
          },
        ]}
        rows={faculties.android.rows}
        emptyKey="mb.android.empty"
        hideEmpty={faculties.android.rows.length === 0}
        manageHref={links.apps}
        manageKey="mb.open"
      />
      <LedgerFacultyView
        titleKey="mb.login.title"
        helpKey="mb.login.help"
        tiles={[
          { labelKey: "mb.login.method", value: t("mb.login.bearer") },
          { labelKey: "mb.login.web", value: t("mb.login.cookie") },
        ]}
        rows={[]}
        emptyKey="mb.login.empty"
        hideEmpty
        manageHref={links.apps}
        manageKey="mb.open"
      />
      <LedgerFacultyView
        titleKey="mb.search.title"
        helpKey="mb.search.help"
        tiles={[{ labelKey: "mb.search.approved", value: faculties.search.approved }]}
        rows={[]}
        emptyKey="mb.search.empty"
        hideEmpty={faculties.search.approved > 0}
        manageHref={links.search}
        manageKey="mb.search.open"
      />
      <LedgerFacultyView
        titleKey="mb.book.title"
        helpKey="mb.book.help"
        tiles={[{ labelKey: "mb.book.count", value: faculties.booking.lessons }]}
        rows={faculties.booking.rows}
        emptyKey="mb.book.empty"
        manageHref={links.booking}
        manageKey="mb.book.open"
      />
      <LedgerFacultyView
        titleKey="mb.pay.title"
        helpKey="mb.pay.help"
        tiles={[
          { labelKey: "mb.pay.lessons", value: faculties.payments.lessons },
          ...(faculties.payments.payouts === null
            ? []
            : [
                {
                  labelKey: "mb.pay.payouts" as const,
                  value: faculties.payments.payouts,
                },
              ]),
        ]}
        rows={faculties.payments.rows}
        emptyKey="mb.pay.empty"
        manageHref={links.payments}
        manageKey="mb.pay.open"
      />
      <LedgerFacultyView
        titleKey="mb.class.title"
        helpKey="mb.class.help"
        tiles={[{ labelKey: "mb.class.count", value: faculties.classroom.rooms }]}
        rows={faculties.classroom.rows}
        emptyKey="mb.class.empty"
        manageHref={links.classroom}
        manageKey="mb.class.open"
      />
      <LedgerFacultyView
        titleKey="mb.msg.title"
        helpKey="mb.msg.help"
        tiles={[
          { labelKey: "mb.msg.count", value: faculties.messaging.conversations },
        ]}
        rows={faculties.messaging.rows}
        emptyKey="mb.msg.empty"
        manageHref={links.messages}
        manageKey="mb.msg.open"
      />
      <LedgerFacultyView
        titleKey="mb.hw.title"
        helpKey="mb.hw.help"
        tiles={[{ labelKey: "mb.hw.count", value: faculties.homework.pieces }]}
        rows={faculties.homework.rows}
        emptyKey="mb.hw.empty"
        manageHref={links.homework}
        manageKey="mb.hw.open"
      />
      <LedgerFacultyView
        titleKey="mb.rep.title"
        helpKey="mb.rep.help"
        tiles={[{ labelKey: "mb.rep.count", value: faculties.reports.records }]}
        rows={faculties.reports.rows}
        emptyKey="mb.rep.empty"
        manageHref={links.reports}
        manageKey="mb.rep.open"
      />
      <LedgerFacultyView
        titleKey="mb.prog.title"
        helpKey="mb.prog.help"
        tiles={[{ labelKey: "mb.prog.count", value: faculties.progress.rowsCount }]}
        rows={faculties.progress.rows}
        emptyKey="mb.prog.empty"
        manageHref={links.progress}
        manageKey="mb.prog.open"
      />
      <LedgerFacultyView
        titleKey="mb.note.title"
        helpKey="mb.note.help"
        tiles={[
          { labelKey: "mb.note.count", value: faculties.notifications.total },
          { labelKey: "mb.note.unread", value: faculties.notifications.unread },
        ]}
        rows={faculties.notifications.rows}
        emptyKey="mb.note.empty"
        manageHref={links.notifications}
        manageKey="mb.note.open"
      />
      <LedgerFacultyView
        titleKey="mb.rec.title"
        helpKey="mb.rec.help"
        tiles={[{ labelKey: "mb.rec.count", value: faculties.recordings.total }]}
        rows={faculties.recordings.rows}
        emptyKey="mb.rec.empty"
        manageHref={links.recordings}
        manageKey="mb.rec.open"
      />
      <LedgerFacultyView
        titleKey="mb.lib.title"
        helpKey="mb.lib.help"
        tiles={[
          { labelKey: "mb.lib.count", value: faculties.materials.published },
          ...(faculties.materials.yours === null
            ? []
            : [
                {
                  labelKey: "mb.lib.yours" as const,
                  value: faculties.materials.yours,
                },
              ]),
        ]}
        rows={faculties.materials.rows}
        emptyKey="mb.lib.empty"
        manageHref={links.materials}
        manageKey="mb.lib.open"
      />
      <LedgerFacultyView
        titleKey="mb.push.title"
        helpKey="mb.push.help"
        tiles={[
          { labelKey: "mb.push.connected", value: t("mb.push.off") },
          { labelKey: "mb.push.sent", value: faculties.push.sent },
          { labelKey: "mb.push.devices", value: faculties.push.devices },
          ...(faculties.push.allDevices === null
            ? []
            : [
                {
                  labelKey: "mb.push.all" as const,
                  value: faculties.push.allDevices,
                },
              ]),
        ]}
        rows={faculties.push.rows}
        emptyKey="mb.push.empty"
        hideEmpty={faculties.push.rows.length === 0}
        manageHref={links.apps}
        manageKey="mb.open"
      />
    </div>
  );
}
