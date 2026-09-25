"use client";

import { useState, type FormEvent } from "react";
import { useT } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { fieldClass, postJson } from "@/lib/api";
import type { CertificateDesk } from "@/server/lms/certificates";

const kindKeys = {
  exam: "cert.kind.exam",
  quiz: "cert.kind.quiz",
  course: "cert.kind.course",
  manual: "cert.kind.manual",
} as const;

const statusKeys = {
  draft: "cert.status.draft",
  active: "cert.status.active",
  retired: "cert.status.retired",
} as const;

export function CertificateDeskView({
  initial,
}: {
  initial: CertificateDesk;
}) {
  const t = useT();
  const [desk, setDesk] = useState(initial);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [editingId, setEditingId] = useState("");

  const editing = desk.templates.find((item) => item.id === editingId);

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setError("");
    setMessage("");
    try {
      const next = await postJson<CertificateDesk>("/api/v1/certificates", {
        action: "save",
        id: String(data.get("id") ?? "") || undefined,
        name: String(data.get("name") ?? ""),
        subjectSlug: String(data.get("subjectSlug") ?? ""),
        description: String(data.get("description") ?? ""),
        heading: String(data.get("heading") ?? ""),
        body: String(data.get("body") ?? ""),
        signOff: String(data.get("signOff") ?? ""),
        awardKind: String(data.get("awardKind") ?? "manual"),
        awardSourceId: String(data.get("awardSourceId") ?? ""),
        passPercent: Number(data.get("passPercent") ?? 0),
        autoIssue: data.get("autoIssue") === "on",
        status: String(data.get("status") ?? "draft"),
      });
      setDesk(next);
      setMessage(t("cert.saved"));
      setEditingId("");
      form.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("cert.failed"));
    } finally {
      setPending(false);
    }
  }

  async function onIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setError("");
    setMessage("");
    try {
      const next = await postJson<CertificateDesk>("/api/v1/certificates", {
        action: "issue",
        certificateId: String(data.get("certificateId") ?? ""),
        studentUserId: String(data.get("studentUserId") ?? ""),
      });
      setDesk(next);
      setMessage(t("cert.issued"));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : t("cert.issue_failed"),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      {desk.canManageTemplates ? (
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
            {t("cert.templates")}
          </h2>
          <p className="mt-2 text-sm text-muted">{t("cert.body_help")}</p>
          <form
            key={editing?.id ?? "new"}
            className="mt-6 grid gap-3 md:grid-cols-2"
            onSubmit={onSave}
          >
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            <input
              name="name"
              required
              defaultValue={editing?.name ?? ""}
              placeholder={t("cert.name")}
              className={`${fieldClass} md:col-span-2`}
            />
            <input
              name="heading"
              defaultValue={editing?.heading ?? ""}
              placeholder={t("cert.heading")}
              className={`${fieldClass} md:col-span-2`}
            />
            <textarea
              name="body"
              rows={4}
              defaultValue={editing?.body ?? ""}
              placeholder={t("cert.body")}
              className={`${fieldClass} min-h-28 py-3 md:col-span-2`}
            />
            <input
              name="signOff"
              defaultValue={editing?.signOff ?? ""}
              placeholder={t("cert.sign_off")}
              className={fieldClass}
            />
            <input
              name="description"
              defaultValue={editing?.description ?? ""}
              placeholder={t("cert.description")}
              className={fieldClass}
            />
            <select
              name="subjectSlug"
              className={fieldClass}
              defaultValue={editing?.subjectSlug ?? ""}
            >
              <option value="">{t("library.any_subject")}</option>
              {desk.subjects.map((subject) => (
                <option key={subject.slug} value={subject.slug}>
                  {subject.name}
                </option>
              ))}
            </select>
            <select
              name="awardKind"
              className={fieldClass}
              defaultValue={editing?.awardKind ?? "manual"}
            >
              <option value="manual">{t("cert.kind.manual")}</option>
              <option value="exam">{t("cert.kind.exam")}</option>
              <option value="quiz">{t("cert.kind.quiz")}</option>
              <option value="course">{t("cert.kind.course")}</option>
            </select>
            <select
              name="awardSourceId"
              className={fieldClass}
              defaultValue={editing?.awardSourceId ?? ""}
            >
              <option value="">{t("cert.any_source")}</option>
              {desk.sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {t(kindKeys[source.kind])} · {source.title}
                </option>
              ))}
            </select>
            <input
              name="passPercent"
              type="number"
              min={0}
              max={100}
              defaultValue={editing?.passPercent ?? 0}
              placeholder={t("cert.pass_percent")}
              className={fieldClass}
            />
            <select
              name="status"
              className={fieldClass}
              defaultValue={editing?.status ?? "draft"}
            >
              <option value="draft">{t("cert.status.draft")}</option>
              <option value="active">{t("cert.status.active")}</option>
              <option value="retired">{t("cert.status.retired")}</option>
            </select>
            <label className="flex items-center gap-2 text-sm font-semibold text-brand">
              <input
                type="checkbox"
                name="autoIssue"
                defaultChecked={editing?.autoIssue ?? false}
              />
              {t("cert.auto_issue")}
            </label>
            <div className="md:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? t("cert.save") : editing ? t("cert.save") : t("cert.create")}
              </Button>
            </div>
          </form>
          {desk.templates.length ? (
            <ul className="mt-6 grid gap-2">
              {desk.templates.map((template) => (
                <li
                  key={template.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background px-4 py-3"
                >
                  <div>
                    <p className="font-heading font-bold tracking-tight text-brand">
                      {template.name}
                    </p>
                    <p className="text-sm text-muted">
                      {t(kindKeys[template.awardKind])}
                      {" · "}
                      {t(statusKeys[template.status])}
                      {template.autoIssue ? ` · ${t("cert.auto_issue")}` : ""}
                      {template.subjectName ? ` · ${template.subjectName}` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => setEditingId(template.id)}
                  >
                    {t("cert.edit")}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-sm text-muted">{t("cert.none.templates")}</p>
          )}
        </section>
      ) : null}

      {desk.canIssue ? (
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
            {t("cert.issue")}
          </h2>
          <form className="mt-6 grid gap-3 md:grid-cols-2" onSubmit={onIssue}>
            <select name="certificateId" required className={fieldClass}>
              <option value="">{t("cert.templates")}</option>
              {desk.templates
                .filter((item) => item.status === "active")
                .map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
            </select>
            <select name="studentUserId" required className={fieldClass}>
              <option value="">{t("cert.choose")}</option>
              {desk.learners.map((learner) => (
                <option key={learner.studentUserId} value={learner.studentUserId}>
                  {learner.name}
                </option>
              ))}
            </select>
            <div className="md:col-span-2">
              <Button type="submit" disabled={pending}>
                {t("cert.issue")}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
          {t("cert.awards")}
        </h2>
        {desk.learners.length > 1 ? (
          <p className="mt-3 text-sm font-semibold">
            {t("cert.choose")}
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
        {desk.awards.length ? (
          <ul className="mt-4 grid gap-2">
            {desk.awards.map((award) => (
              <li key={award.id}>
                <a
                  href={award.href}
                  className="block rounded-2xl bg-background px-4 py-3"
                >
                  <p className="font-heading font-bold tracking-tight text-brand">
                    {award.certificateName}
                    {" · "}
                    {award.studentName}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {t(kindKeys[award.sourceKind])}
                    {award.sourceTitle ? ` · ${award.sourceTitle}` : ""}
                    {" · "}
                    {t("cert.view")}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted">
            {desk.learners.length
              ? t("cert.none.awards")
              : t("cert.none.learners")}
          </p>
        )}
      </section>

      {error ? (
        <p className="rounded-2xl bg-gold px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-brand">
          {message}
        </p>
      ) : null}
    </div>
  );
}
