"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, getJson, patchJson, postJson } from "@/lib/api";
import { StaffFlash, StaffStat } from "./staff-stat";

type Subject = {
  slug: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  sortOrder: number;
};

type Certificate = {
  id: string;
  name: string;
  subjectSlug: string | null;
  subjectName: string | null;
  status: string;
  description: string | null;
  heading?: string;
  awardKind?: string;
  autoIssue?: boolean;
  passPercent?: number;
};

type Workspace = {
  summary: {
    subjects: number;
    enabledSubjects: number;
    materials: number;
    publishedMaterials: number;
    certificates: number;
    activeCertificates: number;
  };
  subjects: Subject[];
  certificates: Certificate[];
};

export function AcademicWorkspace({
  initial,
  canCurriculum,
  canCertificates,
  canReport,
}: {
  initial: Workspace;
  canCurriculum: boolean;
  canCertificates: boolean;
  canReport: boolean;
}) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function refresh() {
    setData(await getJson<Workspace>("/api/v1/staff/academic/subjects"));
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StaffStat label="Subjects" value={data.summary.subjects} />
        <StaffStat label="Live subjects" value={data.summary.enabledSubjects} />
        <StaffStat label="Library items" value={data.summary.materials} />
        <StaffStat label="Published materials" value={data.summary.publishedMaterials} />
        <StaffStat label="Certificates" value={data.summary.certificates} />
        <StaffStat label="Active certificates" value={data.summary.activeCertificates} />
      </div>
      {canReport ? (
        <p className="mt-4 rounded-[2rem] bg-mint px-5 py-4 font-semibold text-brand">
          Open student reports for quiz, exam, homework, and lesson results. Subject and certificate counts stay here.
        </p>
      ) : null}

      {canCurriculum ? (
        <form
          className="mt-8 rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            setMessage("");
            const form = new FormData(event.currentTarget);
            try {
              await postJson("/api/v1/staff/academic/subjects", {
                slug: String(form.get("slug") ?? ""),
                name: String(form.get("name") ?? ""),
                description: String(form.get("description") ?? ""),
                sortOrder: Number(form.get("sortOrder") ?? 100),
              });
              event.currentTarget.reset();
              await refresh();
              setMessage("Subject added.");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not save");
            } finally {
              setPending(false);
            }
          }}
        >
          <h2 className="text-xl font-extrabold text-brand">Add subject</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">Name</span>
              <input name="name" required minLength={2} className={fieldClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">Slug</span>
              <input
                name="slug"
                required
                placeholder="islamic-studies"
                className={fieldClass}
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-bold text-brand">
                Description
              </span>
              <input name="description" className={fieldClass} />
            </label>
          </div>
          <Button type="submit" className="mt-4" disabled={pending}>
            {pending ? "Saving…" : "Add subject"}
          </Button>
        </form>
      ) : null}

      <ul className="mt-8 grid gap-3">
        {data.subjects.map((subject) => (
          <li
            key={subject.slug}
            className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-line bg-surface px-5 py-4"
          >
            <div>
              <h3 className="font-extrabold text-brand">{subject.name}</h3>
              <p className="text-sm text-muted">
                {subject.slug}
                {subject.description ? ` · ${subject.description}` : ""}
              </p>
            </div>
            {canCurriculum ? (
              <Button
                variant="secondary"
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  setError("");
                  try {
                    await patchJson(`/api/v1/staff/academic/subjects/${subject.slug}`, {
                      isEnabled: !subject.isEnabled,
                    });
                    await refresh();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not update");
                  } finally {
                    setPending(false);
                  }
                }}
              >
                {subject.isEnabled ? "Disable" : "Enable"}
              </Button>
            ) : (
              <span className="text-sm font-semibold text-muted">
                {subject.isEnabled ? "Live" : "Hidden"}
              </span>
            )}
          </li>
        ))}
      </ul>

      {canCertificates ? (
        <form
          className="mt-8 rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            setMessage("");
            const form = new FormData(event.currentTarget);
            try {
              await postJson("/api/v1/staff/academic/certificates", {
                name: String(form.get("name") ?? ""),
                subjectSlug: String(form.get("subjectSlug") ?? ""),
                description: String(form.get("description") ?? ""),
                heading: String(form.get("heading") ?? ""),
                body: String(form.get("body") ?? ""),
                signOff: String(form.get("signOff") ?? ""),
                awardKind: String(form.get("awardKind") ?? "manual"),
                passPercent: Number(form.get("passPercent") ?? 0),
                autoIssue: form.get("autoIssue") === "on",
              });
              event.currentTarget.reset();
              await refresh();
              setMessage("Certificate added.");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not save");
            } finally {
              setPending(false);
            }
          }}
        >
          <h2 className="text-xl font-extrabold text-brand">Add certificate</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">Name</span>
              <input name="name" required minLength={2} className={fieldClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">Subject</span>
              <select name="subjectSlug" className={fieldClass} defaultValue="">
                <option value="">Any subject</option>
                {data.subjects.map((subject) => (
                  <option key={subject.slug} value={subject.slug}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-bold text-brand">
                Description
              </span>
              <input name="description" className={fieldClass} />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-bold text-brand">
                Heading
              </span>
              <input
                name="heading"
                defaultValue="Certificate of completion"
                className={fieldClass}
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-bold text-brand">
                Wording
              </span>
              <textarea
                name="body"
                rows={3}
                defaultValue="This certifies that {student} has successfully completed {title}."
                className={`${fieldClass} min-h-24 py-3`}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">
                Sign-off
              </span>
              <input
                name="signOff"
                defaultValue="Al Haramain Schools"
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">
                Award for
              </span>
              <select name="awardKind" className={fieldClass} defaultValue="manual">
                <option value="manual">Manual award</option>
                <option value="exam">Exam</option>
                <option value="quiz">Quiz</option>
                <option value="course">Course</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">
                Minimum percent
              </span>
              <input
                name="passPercent"
                type="number"
                min={0}
                max={100}
                defaultValue={0}
                className={fieldClass}
              />
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm font-bold text-brand">
              <input type="checkbox" name="autoIssue" />
              Issue automatically when the student qualifies
            </label>
          </div>
          <Button type="submit" className="mt-4" disabled={pending}>
            {pending ? "Saving…" : "Add certificate"}
          </Button>
        </form>
      ) : null}

      <StaffFlash error={error} message={message} />

      <ul className="mt-8 grid gap-3">
        {data.certificates.map((certificate) => (
          <li
            key={certificate.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-line bg-surface px-5 py-4"
          >
            <div>
              <h3 className="font-extrabold text-brand">{certificate.name}</h3>
              <p className="text-sm text-muted">
                {certificate.subjectName ?? "Any subject"}
                {certificate.awardKind ? ` · ${certificate.awardKind}` : ""}
                {certificate.autoIssue ? " · auto-issue" : ""}
                {certificate.description ? ` · ${certificate.description}` : ""}
              </p>
            </div>
            {canCertificates ? (
              <select
                className="min-h-10 rounded-xl border border-line bg-background px-2 font-semibold"
                value={certificate.status}
                disabled={pending}
                onChange={async (event) => {
                  setPending(true);
                  setError("");
                  try {
                    await patchJson(
                      `/api/v1/staff/academic/certificates/${certificate.id}`,
                      { status: event.target.value },
                    );
                    await refresh();
                  } catch (err) {
                    setError(
                      err instanceof Error ? err.message : "Could not update",
                    );
                  } finally {
                    setPending(false);
                  }
                }}
              >
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="retired">retired</option>
              </select>
            ) : (
              <span className="text-sm font-semibold capitalize text-muted">
                {certificate.status}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
