"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  deleteJson,
  fieldClass,
  postJson,
} from "@/lib/api";
import {
  TeacherAgreementRecord,
  TeacherAgreementSignForm,
} from "@/components/teachers/teacher-agreement-record";
import { TeacherProfileForm } from "@/components/teachers/teacher-profile-form";
import { IntroVideoForm } from "@/components/teachers/intro-video-form";
import {
  documentTypeLabel,
  documentTypesForPurpose,
  reviewStatusLabel,
} from "@/lib/teacher-documents";
import type { IntroVideoPlayback } from "@/lib/intro-video";
import {
  applicationEventLabel,
  applicationStatusLabel,
  formatInterviewTime,
  interviewStatusLabel,
} from "@/lib/teacher-status";

export type OnboardingState = {
  displayName: string;
  email: string;
  verificationStatus: string;
  reviewNote: string | null;
  canEdit: boolean;
  canEditDocuments: boolean;
  canEditVideo: boolean;
  canSignAgreement: boolean;
  readyToSubmit: boolean;
  profile: {
    headline: string;
    bio: string;
    languages: string;
    country: string;
    gender?: string;
    audienceSlugs?: string[];
    subjectSlugs: string[];
  };
  documents: {
    id: string;
    purpose: string;
    documentType: string;
    originalName: string | null;
    mimeType: string;
    byteSize: number;
    externalUrl: string | null;
    reviewStatus: string;
    reviewNote: string | null;
  }[];
  video: {
    id: string;
    originalName: string | null;
    externalUrl: string | null;
    reviewStatus: string;
    reviewNote: string | null;
    playback?: IntroVideoPlayback | null;
  } | null;
  agreement: {
    id: string;
    version: string;
    title: string;
    clauses: string[];
    signatureName: string;
    acceptedAt: string | Date;
    ipAddress: string | null;
    contentHash: string | null;
    valid: boolean;
    current: boolean;
  } | null;
  agreements?: {
    id: string;
    version: string;
    title: string;
    clauses: string[];
    signatureName: string;
    acceptedAt: string | Date;
    ipAddress: string | null;
    contentHash: string | null;
    valid: boolean;
    current: boolean;
  }[];
  agreementVersion: string;
  agreementTitle?: string;
  agreementClauses: readonly string[];
  steps: {
    profile: boolean;
    documents: boolean;
    video: boolean;
    agreement: boolean;
  };
  catalog: { slug: string; name: string }[];
  countries: { iso2: string; name: string }[];
  interview?: {
    id: string;
    status: string;
    scheduledAt: string | Date | null;
    meetingUrl: string | null;
    staffNote: string | null;
    open: boolean;
  } | null;
  events?: {
    id: string;
    kind: string;
    fromStatus: string | null;
    toStatus: string | null;
    note: string | null;
    createdAt: string | Date;
  }[];
};

const stepLabels = [
  { key: "profile", label: "Profile" },
  { key: "documents", label: "Documents" },
  { key: "video", label: "Intro video" },
  { key: "agreement", label: "Agreement" },
] as const;

export function TeacherOnboarding({ initial }: { initial: OnboardingState }) {
  const [state, setState] = useState(initial);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [documentPurpose, setDocumentPurpose] = useState<
    "identity" | "qualification"
  >("identity");

  const statusLabel = useMemo(
    () => applicationStatusLabel(state.verificationStatus),
    [state.verificationStatus],
  );

  return (
    <div>
      <p className="text-sm font-semibold text-muted">
        {state.displayName} · {state.email} · {statusLabel}
        {" · "}
        <Link href="/teach/status" className="font-bold text-brand underline">
          Verification status
        </Link>
      </p>
      <ol className="mt-6 grid gap-3 sm:grid-cols-4">
        {stepLabels.map((step, index) => (
          <li
            key={step.key}
            className={`rounded-[2rem] px-4 py-3 text-sm font-bold ${
              state.steps[step.key]
                ? "bg-mint text-brand"
                : "bg-surface text-muted"
            }`}
          >
            {index + 1}. {step.label}
          </li>
        ))}
      </ol>
      {state.verificationStatus === "under_review" ? (
        <p className="mt-6 rounded-[2rem] bg-gold px-5 py-4 font-semibold text-brand">
          Your application is with staff. You can still attach identity and
          qualification files. Profile details stay locked until staff send the
          application back.
        </p>
      ) : null}
      {state.verificationStatus === "interview_required" ? (
        <div className="mt-6 rounded-[2rem] bg-gold px-5 py-4 font-semibold text-brand">
          <p>
            Staff asked for an interview. You can update your documents, then
            submit again.
          </p>
          {state.interview ? (
            <div className="mt-3 text-sm font-semibold">
              <p>{interviewStatusLabel(state.interview.status)}</p>
              <p className="mt-1">
                {formatInterviewTime(state.interview.scheduledAt)}
              </p>
              {state.interview.meetingUrl ? (
                <p className="mt-1">
                  <a
                    href={state.interview.meetingUrl}
                    className="underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open meeting link
                  </a>
                </p>
              ) : null}
              {state.interview.staffNote ? (
                <p className="mt-1">Staff note: {state.interview.staffNote}</p>
              ) : null}
              {state.interview.status === "scheduled" ? (
                <Button
                  type="button"
                  className="mt-3"
                  disabled={pending}
                  onClick={async () => {
                    setPending(true);
                    setError("");
                    try {
                      setState(
                        await postJson<OnboardingState>(
                          "/api/v1/teacher/onboarding/interview",
                          { confirmed: true },
                        ),
                      );
                      setMessage("Interview confirmed.");
                    } catch (err) {
                      setError(
                        err instanceof Error ? err.message : "Could not confirm",
                      );
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  Confirm I can attend
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {state.verificationStatus === "documents_pending" ? (
        <p className="mt-6 rounded-[2rem] bg-gold px-5 py-4 font-semibold text-brand">
          Staff asked you to replace or add identity or qualification documents.
          Upload a new file, then submit again.
        </p>
      ) : null}
      {state.verificationStatus === "rejected" ? (
        <p className="mt-6 rounded-[2rem] bg-rose px-5 py-4 font-semibold text-brand">
          Staff did not approve this application. Update the items in their
          note, then submit again for another review.
        </p>
      ) : null}
      {state.events?.length ? (
        <ol className="mt-6 space-y-2">
          {state.events.map((event) => (
            <li key={event.id} className="text-sm text-muted">
              <span className="font-bold text-brand">
                {applicationEventLabel(event.kind)}
              </span>
              {event.toStatus ? ` · ${applicationStatusLabel(event.toStatus)}` : ""}
              {event.note ? ` · ${event.note}` : ""}
            </li>
          ))}
        </ol>
      ) : null}
      {state.reviewNote ? (
        <p className="mt-4 rounded-[2rem] bg-mint px-5 py-4 font-semibold text-brand">
          Staff note: {state.reviewNote}
        </p>
      ) : null}

      <div className="mt-8">
        <TeacherProfileForm<OnboardingState>
          title="1. Teaching profile"
          action="/api/v1/teacher/onboarding/profile"
          initial={state.profile}
          catalog={state.catalog}
          countries={state.countries}
          disabled={!state.canEdit}
          onSaved={setState}
        />
      </div>

      <section className="mt-8 rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-xl font-extrabold text-brand">2. Documents</h2>
        <p className="mt-2 text-sm text-muted">
          Attach at least one identity document and one qualification. Staff
          then mark each file as verified. Verified documents cannot be removed.
          Object storage comes later; we store the file record and an optional
          http or https link.
        </p>
        {state.documents.length ? (
        <ul className="mt-4 space-y-2">
          {state.documents.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-mint/60 px-4 py-3 text-sm"
            >
              <span className="font-semibold text-brand">
                {documentTypeLabel(doc.documentType)} ·{" "}
                {reviewStatusLabel(doc.reviewStatus)} · {doc.originalName} ·{" "}
                {Math.round(doc.byteSize / 1024)} KB
                {doc.externalUrl ? (
                  <>
                    {" · "}
                    <a href={doc.externalUrl} className="underline" target="_blank" rel="noreferrer">
                      Open link
                    </a>
                  </>
                ) : null}
                {doc.reviewNote ? (
                  <span className="mt-1 block text-xs font-bold">
                    Staff note: {doc.reviewNote}
                  </span>
                ) : null}
              </span>
              {state.canEditDocuments && doc.reviewStatus !== "verified" ? (
                <button
                  type="button"
                  className="font-bold text-brand underline"
                  onClick={async () => {
                    setPending(true);
                    setError("");
                    try {
                      setState(
                        await deleteJson<OnboardingState>(
                          `/api/v1/teacher/onboarding/documents/${doc.id}`,
                        ),
                      );
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Could not remove");
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        ) : (
          <p className="mt-4 text-sm font-semibold text-muted">
            No identity or qualification files attached yet.
          </p>
        )}
        {state.canEditDocuments ? (
          <form
            className="mt-4 grid gap-4 md:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              const file = (form.elements.namedItem("file") as HTMLInputElement)
                .files?.[0];
              setPending(true);
              setError("");
              try {
                const link = String(data.get("externalUrl") ?? "").trim();
                if (!file && !link) {
                  throw new Error(
                    "Choose a file or add an http/https document link",
                  );
                }
                const next = await postJson<OnboardingState>(
                  "/api/v1/teacher/onboarding/documents",
                  {
                    purpose: documentPurpose,
                    documentType: String(data.get("documentType") ?? "other"),
                    originalName:
                      file?.name ||
                      String(data.get("originalName") ?? "").trim() ||
                      (link ? "document-link" : "document"),
                    mimeType: file?.type || "application/octet-stream",
                    byteSize: file?.size || Number(data.get("byteSize") || 1),
                    externalUrl: link || undefined,
                  },
                );
                setState(next);
                form.reset();
                setMessage("Document attached.");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not attach");
              } finally {
                setPending(false);
              }
            }}
          >
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">Category</span>
              <select
                name="purpose"
                className={fieldClass}
                value={documentPurpose}
                onChange={(event) =>
                  setDocumentPurpose(
                    event.target.value === "qualification"
                      ? "qualification"
                      : "identity",
                  )
                }
              >
                <option value="identity">Identity</option>
                <option value="qualification">Qualification</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">
                Document type
              </span>
              <select name="documentType" className={fieldClass}>
                {documentTypesForPurpose(documentPurpose).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-brand">File</span>
              <input type="file" name="file" className={fieldClass} />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-bold text-brand">
                Optional http or https link
              </span>
              <input
                name="externalUrl"
                className={fieldClass}
                placeholder="https:// or http://"
              />
            </label>
            <Button type="submit" disabled={pending}>
              Attach document
            </Button>
          </form>
        ) : (
          <p className="mt-4 rounded-2xl bg-gold px-4 py-3 text-sm font-semibold text-brand">
            {state.verificationStatus === "suspended"
              ? "This account is suspended, so documents cannot be changed."
              : "Identity and qualification files are locked on this application."}
          </p>
        )}
        {error ? (
          <p className="mt-4 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
            {error}
          </p>
        ) : null}
      </section>

      <div className="mt-8">
        <IntroVideoForm<OnboardingState>
          title="3. Introduction video"
          video={state.video}
          canEdit={state.canEditVideo ?? state.canEdit}
          onSaved={async (next) => {
            setState(next);
            setMessage("Introduction video saved.");
          }}
        />
      </div>

      <div className="mt-8 grid gap-4">
        {state.agreement ? (
          <TeacherAgreementRecord record={state.agreement} />
        ) : null}
        {state.agreements
          ?.filter((item) => item.id !== state.agreement?.id)
          .map((record) => (
            <TeacherAgreementRecord key={record.id} record={record} />
          ))}
        {state.canSignAgreement ? (
          <TeacherAgreementSignForm<OnboardingState>
            title={`4. ${state.agreementTitle ?? "Teacher agreement"}`}
            version={state.agreementVersion}
            clauses={[...state.agreementClauses]}
            defaultName={state.displayName}
            onSigned={(next) => {
              setState(next);
              setMessage("Agreement signed and stored.");
            }}
          />
        ) : null}
      </div>

      {state.canEdit ? (
        <div className="mt-8">
          <Button
            disabled={pending || !state.readyToSubmit}
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                setState(
                  await postJson<OnboardingState>(
                    "/api/v1/teacher/onboarding/submit",
                    {},
                  ),
                );
                setMessage("Application submitted for review.");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not submit");
              } finally {
                setPending(false);
              }
            }}
          >
            Submit application
          </Button>
          {!state.readyToSubmit ? (
            <p className="mt-3 text-sm text-muted">
              Complete every step above before submitting.
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-6 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-6 rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-brand">
          {message}
        </p>
      ) : null}
    </div>
  );
}
