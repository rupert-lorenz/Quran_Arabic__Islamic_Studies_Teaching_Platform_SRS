"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";
import { fieldClass, postForm, postJson } from "@/lib/api";
import { formatLibraryFileSize } from "@/lib/library-materials";
import { homeworkFileAccept } from "@/lib/homework";
import type { HomeworkDesk } from "@/server/lms/homework";
import type { HomeworkView } from "@/server/lms/homework";

const statusKeys = {
  draft: "homework.status.draft",
  assigned: "homework.status.assigned",
  closed: "homework.status.closed",
} as const;

const workKeys = {
  assigned: "homework.work.assigned",
  submitted: "homework.work.submitted",
  marked: "homework.work.marked",
} as const;

export function HomeworkDetail({
  initial,
  students,
}: {
  initial: HomeworkView;
  students: HomeworkDesk["students"];
}) {
  const t = useT();
  const [item, setItem] = useState(initial);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function runJson(body: Record<string, unknown>) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const next = await postJson<HomeworkView>(`/api/v1/homework/${item.id}`, body);
      setItem(next);
      setMessage(t("homework.saved"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("homework.failed"));
    } finally {
      setPending(false);
    }
  }

  async function runFile(form: HTMLFormElement) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const next = await postForm<HomeworkView>(
        `/api/v1/homework/${item.id}/files`,
        new FormData(form),
      );
      setItem(next);
      setMessage(t("homework.saved"));
      form.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("homework.failed"));
    } finally {
      setPending(false);
    }
  }

  function onAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    void runJson({ action: "assign", ...data });
  }

  function onSubmitWork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = String(new FormData(event.currentTarget).get("text") ?? "");
    void runJson({ action: "submit", text });
  }

  function onMark(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    void runJson({ action: "mark", ...data });
  }

  const ownWork = item.work[0];

  return (
    <section className="grid gap-6">
      <article className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <p className="font-heading text-sm font-bold tracking-tight text-brand">
          {t(statusKeys[item.status])}
          {item.subjectName ? ` · ${item.subjectName}` : ""}
          {item.dueAt
            ? ` · ${t("homework.due")} ${new Date(item.dueAt).toLocaleString()}`
            : ""}
        </p>
        <h2 className="mt-2 font-heading text-2xl font-bold tracking-tight text-brand">
          {item.title}
        </h2>
        <p className="mt-2 text-sm text-muted">
          {t("homework.from")} {item.teacherName}
        </p>
        {item.instructions ? (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-brand">
            {item.instructions}
          </p>
        ) : null}
        {item.briefFiles.length ? (
          <ul className="mt-4 grid gap-2">
            {item.briefFiles.map((file) => (
              <li key={file.id}>
                <a href={file.href} className="text-sm font-semibold text-brand underline">
                  {file.name} · {formatLibraryFileSize(file.byteSize)}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </article>

      {item.canManage ? (
        <article className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h3 className="font-heading text-lg font-bold tracking-tight text-brand">
            {t("homework.assign")}
          </h3>
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={onAssign}>
            {students.length ? (
              <select name="studentUserId" className={fieldClass} defaultValue="">
                <option value="">{t("homework.choose_student")}</option>
                {students.map((student) => (
                  <option key={student.userId} value={student.userId}>
                    {student.name}
                  </option>
                ))}
              </select>
            ) : null}
            <input
              name="email"
              type="email"
              placeholder={t("homework.email")}
              className={fieldClass}
            />
            <Button type="submit" disabled={pending} className="md:col-span-2">
              {t("homework.assign")}
            </Button>
          </form>
          <form
            className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              void runFile(event.currentTarget);
            }}
          >
            <input type="hidden" name="kind" value="brief" />
            <input
              name="file"
              type="file"
              required
              accept={homeworkFileAccept()}
              className={fieldClass}
            />
            <Button type="submit" disabled={pending}>
              {t("homework.attach")}
            </Button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2">
            {item.status !== "closed" ? (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => void runJson({ action: "set_status", status: "closed" })}
              >
                {t("homework.close")}
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => void runJson({ action: "set_status", status: "assigned" })}
              >
                {t("homework.reopen")}
              </Button>
            )}
          </div>
        </article>
      ) : null}

      {item.canSubmit ? (
        <article className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h3 className="font-heading text-lg font-bold tracking-tight text-brand">
            {t("homework.submit")}
          </h3>
          <form className="mt-4 grid gap-3" onSubmit={onSubmitWork}>
            <textarea
              name="text"
              rows={4}
              defaultValue={ownWork?.submissionText ?? ""}
              placeholder={t("homework.submission")}
              className={`${fieldClass} min-h-28 py-3`}
            />
            <Button type="submit" disabled={pending}>
              {t("homework.submit")}
            </Button>
          </form>
          <form
            className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              void runFile(event.currentTarget);
            }}
          >
            <input type="hidden" name="kind" value="submission" />
            <input
              name="file"
              type="file"
              required
              accept={homeworkFileAccept()}
              className={fieldClass}
            />
            <Button type="submit" disabled={pending}>
              {t("homework.attach")}
            </Button>
          </form>
        </article>
      ) : null}

      {item.work.map((work) => (
        <article
          key={work.id}
          className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
        >
          <h3 className="font-heading text-lg font-bold tracking-tight text-brand">
            {work.studentName}
          </h3>
          <p className="mt-2 text-sm font-semibold text-muted">
            {t(workKeys[work.status])}
            {work.isLate ? ` · ${t("homework.late")}` : ""}
            {work.submittedAt
              ? ` · ${new Date(work.submittedAt).toLocaleString()}`
              : ""}
          </p>
          {work.submissionText ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-brand">
              {work.submissionText}
            </p>
          ) : null}
          {work.files.length ? (
            <ul className="mt-3 grid gap-2">
              {work.files.map((file) => (
                <li key={file.id}>
                  <a href={file.href} className="text-sm font-semibold text-brand underline">
                    {file.name} · {formatLibraryFileSize(file.byteSize)}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          {work.markLabel || work.feedback ? (
            <p className="mt-4 text-sm font-semibold text-brand">
              {work.markLabel ? `${t("homework.mark")}: ${work.markLabel}` : ""}
              {work.feedback ? (
                <span className="mt-2 block font-normal whitespace-pre-wrap">
                  {work.feedback}
                </span>
              ) : null}
            </p>
          ) : null}
          {item.canManage ? (
            <>
              <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={onMark}>
                <input type="hidden" name="studentUserId" value={work.studentUserId} />
                <input
                  name="markLabel"
                  defaultValue={work.markLabel ?? ""}
                  placeholder={t("homework.mark")}
                  className={fieldClass}
                />
                <input
                  name="feedback"
                  defaultValue={work.feedback ?? ""}
                  placeholder={t("homework.feedback")}
                  className={fieldClass}
                />
                <Button type="submit" disabled={pending} className="md:col-span-2">
                  {t("homework.save_mark")}
                </Button>
              </form>
              <form
                className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runFile(event.currentTarget);
                }}
              >
                <input type="hidden" name="kind" value="feedback" />
                <input type="hidden" name="studentUserId" value={work.studentUserId} />
                <input
                  name="file"
                  type="file"
                  required
                  accept={homeworkFileAccept()}
                  className={fieldClass}
                />
                <Button type="submit" disabled={pending}>
                  {t("homework.attach_feedback")}
                </Button>
              </form>
            </>
          ) : null}
        </article>
      ))}

      {error ? <p className="text-sm font-semibold text-brand">{error}</p> : null}
      {message ? <p className="text-sm font-semibold text-brand">{message}</p> : null}
    </section>
  );
}
