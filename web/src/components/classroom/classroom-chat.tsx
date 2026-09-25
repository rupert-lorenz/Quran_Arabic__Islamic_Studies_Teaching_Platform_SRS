"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { useI18n, useT } from "@/components/i18n/i18n-provider";
import {
  CLASSROOM_MAX_MESSAGE_LENGTH,
  type ClassroomChatMessage,
} from "@/lib/classroom";
import { detectBrowserTimeZone, formatClockInTimeZone } from "@/lib/timezone";

export function ClassroomChat({
  messages,
  selfId,
  draft,
  sending,
  onDraftChange,
  onSend,
}: {
  messages: ClassroomChatMessage[];
  selfId: string;
  draft: string;
  sending: boolean;
  onDraftChange: (value: string) => void;
  onSend: () => void;
}) {
  const t = useT();
  const { locale } = useI18n();
  const list = useRef<HTMLUListElement>(null);
  const pinned = useRef(true);
  const count = useRef(messages.length);
  const [unseen, setUnseen] = useState(0);
  const zone = detectBrowserTimeZone() ?? "UTC";
  const remaining = CLASSROOM_MAX_MESSAGE_LENGTH - draft.length;

  useEffect(() => {
    const node = list.current;
    if (!node) return;
    const grew = messages.length > count.current;
    count.current = messages.length;
    if (pinned.current) {
      node.scrollTop = node.scrollHeight;
      setUnseen(0);
    } else if (grew) {
      setUnseen((value) => value + 1);
    }
  }, [messages]);

  function jumpToLatest() {
    pinned.current = true;
    setUnseen(0);
    const node = list.current;
    if (node) node.scrollTop = node.scrollHeight;
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!draft.trim() || sending) return;
    pinned.current = true;
    onSend();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="text-sm font-extrabold uppercase text-brand-soft">
        {t("classroom.chat")}
      </h2>
      <p className="mt-1 text-xs font-semibold text-muted">{t("classroom.chat_help")}</p>
      <div className="relative mt-3 min-h-40 flex-1">
        <ul
          ref={list}
          className="absolute inset-0 space-y-2 overflow-y-auto pr-1"
          onScroll={() => {
            const node = list.current;
            if (!node) return;
            pinned.current =
              node.scrollHeight - node.scrollTop - node.clientHeight < 48;
            if (pinned.current) setUnseen(0);
          }}
        >
          {messages.length ? (
            messages.map((message) => {
              const mine = message.userId === selfId;
              const roleKey =
                message.role === "teacher" ||
                message.role === "student" ||
                message.role === "parent" ||
                message.role === "staff"
                  ? (`classroom.role_${message.role}` as const)
                  : null;
              return (
                <li
                  key={message.id}
                  className={`rounded-2xl px-3 py-2 ${
                    mine ? "ml-6 bg-gold/50" : "mr-6 bg-background"
                  }`}
                >
                  <p className="flex flex-wrap items-baseline gap-x-2 text-xs font-extrabold text-brand-soft">
                    <span>
                      {message.displayName}
                      {mine ? ` · ${t("classroom.you")}` : ""}
                    </span>
                    {roleKey ? <span>{t(roleKey)}</span> : null}
                    <span className="font-semibold text-muted">
                      {formatClockInTimeZone(message.createdAt, zone, locale)}
                    </span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold text-brand">
                    {message.body}
                  </p>
                </li>
              );
            })
          ) : (
            <li className="rounded-2xl bg-background px-3 py-4 text-sm font-semibold text-muted">
              {t("classroom.chat_empty")}
            </li>
          )}
        </ul>
        {unseen ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="absolute inset-x-6 bottom-2"
            onClick={jumpToLatest}
          >
            {t("classroom.chat_new")}
          </Button>
        ) : null}
      </div>
      <form className="mt-3 space-y-2" onSubmit={submit}>
        <label className="block">
          <span className="sr-only">{t("classroom.chat_placeholder")}</span>
          <textarea
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={onKeyDown}
            maxLength={CLASSROOM_MAX_MESSAGE_LENGTH}
            rows={3}
            className="min-h-20 w-full resize-none rounded-2xl border border-line bg-background px-4 py-3 text-sm font-semibold text-brand"
            placeholder={t("classroom.chat_placeholder")}
          />
        </label>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-muted">
            {draft.length > 400
              ? t("classroom.chat_remaining", { count: remaining })
              : t("classroom.chat_enter")}
          </p>
          <Button type="submit" size="sm" disabled={sending || !draft.trim()}>
            {sending ? t("classroom.sending") : t("classroom.send")}
          </Button>
        </div>
      </form>
    </div>
  );
}
