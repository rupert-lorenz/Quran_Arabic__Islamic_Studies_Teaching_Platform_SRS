"use client";

import Link from "next/link";
import { useState } from "react";
import { useT } from "@/components/i18n/i18n-provider";
import { getJson, postJson } from "@/lib/api";
import type { UiMessageKey } from "@/lib/i18n";
import type { UserNotificationView } from "@/server/notifications/service";

type Inbox = {
  unreadCount: number;
  notifications: UserNotificationView[];
};

export function NotificationMenu({
  initialUnreadCount = 0,
  tone = "default",
}: {
  initialUnreadCount?: number;
  tone?: "default" | "inverse";
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [inbox, setInbox] = useState<Inbox>({
    unreadCount: initialUnreadCount,
    notifications: [],
  });

  async function refresh() {
    const next = await getJson<Inbox>("/api/v1/account/notifications");
    setInbox(next);
  }

  async function markRead(id: string) {
    await postJson(`/api/v1/account/notifications/${id}/read`, {});
    setInbox((current) => ({
      unreadCount: Math.max(
        0,
        current.unreadCount -
          (current.notifications.find((item) => item.id === id && !item.readAt)
            ? 1
            : 0),
      ),
      notifications: current.notifications.map((item) =>
        item.id === id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item,
      ),
    }));
  }

  return (
    <div className="relative">
      <button
        type="button"
        className={`relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 text-sm font-bold ${
          tone === "inverse"
            ? "text-brand-accent hover:bg-white/10 hover:text-white"
            : "text-brand hover:bg-brand/5"
        }`}
        aria-expanded={open}
        aria-label={t("nav.notifications")}
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void refresh().catch(() => undefined);
        }}
      >
        {t("nav.notifications")}
        {inbox.unreadCount ? (
          <span className="ms-1 rounded-full bg-gold px-1.5 text-xs font-extrabold">
            {inbox.unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute end-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-[1.5rem] border border-line bg-surface p-3 shadow-[var(--shadow-card)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase text-brand-soft">
              {t("nav.notifications")}
            </p>
            {inbox.unreadCount ? (
              <button
                type="button"
                className="text-xs font-bold text-brand underline"
                onClick={async () => {
                  const next = await postJson<Inbox>(
                    "/api/v1/account/notifications/read-all",
                    {},
                  );
                  setInbox(next);
                }}
              >
                {t("nav.notifications_mark_all")}
              </button>
            ) : null}
          </div>
          {inbox.notifications.length ? (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {inbox.notifications.map((item) => {
                const reminder = item.kind === "lesson_reminder";
                const titleKey = (
                  item.kind === "group_place_reserved"
                    ? "group.notify_reserved_title"
                    : "group.notify_available_title"
                ) as UiMessageKey;
                const bodyKey = (
                  item.kind === "group_place_reserved"
                    ? "group.notify_reserved"
                    : "group.notify_available"
                ) as UiMessageKey;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className={`block rounded-2xl px-3 py-3 text-sm ${
                        item.readAt ? "bg-background" : "bg-mint"
                      }`}
                      onClick={() => {
                        setOpen(false);
                        if (!item.readAt) void markRead(item.id);
                      }}
                    >
                      <p className="font-extrabold text-brand">
                        {reminder ? item.title : t(titleKey)}
                      </p>
                      <p className="mt-1 font-semibold text-brand">
                        {reminder
                          ? item.body
                          : item.classTitle
                            ? t(bodyKey, {
                                student: item.studentName ?? "",
                                title: item.classTitle,
                                when: item.whenLabel ?? "",
                              })
                            : item.body}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-2xl bg-gold px-3 py-3 text-sm font-semibold text-brand">
              {t("nav.notifications_empty")}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
