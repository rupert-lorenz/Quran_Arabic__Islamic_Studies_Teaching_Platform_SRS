"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fieldClass, patchJson, postJson } from "@/lib/api";
import {
  TeacherAgreementRecord,
  type AgreementRecordView,
} from "@/components/teachers/teacher-agreement-record";
import { IntroVideoPlayer } from "@/components/teachers/intro-video-player";
import type { IntroVideoPlayback } from "@/lib/intro-video";
import {
  checklistReviewClass,
  checklistReviewLabels,
  documentTypeLabel,
  reviewStatusLabel,
} from "@/lib/teacher-documents";
import { TeacherPricingControlForm } from "@/components/staff/teacher-pricing-control-form";
import { TeacherRateBreakdown } from "@/components/teachers/teacher-rate-breakdown";
import { TeacherRateForm } from "@/components/staff/teacher-rate-form";
import { TeacherStatsForm } from "@/components/staff/teacher-stats-form";
import { TeacherStatsPanel } from "@/components/teachers/teacher-stats-panel";
import type { TeacherRateView } from "@/components/teachers/teacher-rate-breakdown";
import type { TeacherStats } from "@/lib/teacher-reputation";
import {
  applicationEventLabel,
  applicationStatusFilters,
  applicationStatusLabel,
  formatInterviewTime,
  interviewStatusLabel,
} from "@/lib/teacher-status";

export type TeacherDocument = {
  id: string;
  purpose: string;
  documentType: string;
  originalName: string | null;
  byteSize: number;
  externalUrl: string | null;
  reviewStatus: string;
  reviewNote: string | null;
  playback?: IntroVideoPlayback | null;
};

export type TeacherApplication = {
  userId: string;
  email: string;
  displayName: string;
  status: string;
  country: string | null;
  headline: string | null;
  bio: string | null;
  languages: string | null;
  lessonsTaught: number;
  responseRate: number | null;
  stats: TeacherStats;
  rate: TeacherRateView | null;
  rateLimits: {
    minFormatted: string;
    maxFormatted: string;
    commissionPercent: number;
    lessonDurationMinutes: number;
    defaultCurrencyCode?: string;
    currencies: { code: string; name: string; symbol: string; decimalPlaces: number }[];
    conflict?: boolean;
    sources?: { label: string; appliesMin: boolean; appliesMax: boolean }[];
    teacherControl?: { minAmount: string; maxAmount: string } | null;
  };
  verificationStatus: string;
  submittedAt: string | Date | null;
  reviewNote: string | null;
  subjects: string[];
  documents: TeacherDocument[];
  video: TeacherDocument | null;
  agreement: AgreementRecordView | null;
  agreements?: AgreementRecordView[];
  agreementVersion?: string;
  checklist: {
    identityVerified: boolean;
    qualificationVerified: boolean;
    videoVerified: boolean;
    identityStatus?: "verified" | "pending" | "rejected" | "missing";
    qualificationStatus?: "verified" | "pending" | "rejected" | "missing";
    videoStatus?: "verified" | "pending" | "rejected" | "missing";
    awaitingReview: boolean;
    needsReplacement: boolean;
    readyToApprove: boolean;
  };
  interview: {
    id: string;
    status: string;
    scheduledAt: string | Date | null;
    meetingUrl: string | null;
    staffNote: string | null;
    open: boolean;
  } | null;
  events: {
    id: string;
    kind: string;
    fromStatus: string | null;
    toStatus: string | null;
    note: string | null;
    createdAt: string | Date;
  }[];
};

export function TeacherApplications({
  applications,
}: {
  applications: TeacherApplication[];
  canReview?: boolean;
  canSeeDocuments?: boolean;
}) {
  const [filter, setFilter] = useState("all");
  const visible =
    filter === "all"
      ? applications
      : applications.filter((item) => item.verificationStatus === filter);

  if (applications.length === 0) {
    return (
      <p className="rounded-[2rem] bg-gold px-5 py-4 font-semibold text-brand">
        No teacher applications yet.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {applicationStatusFilters.map((item) => {
          const count =
            item.value === "all"
              ? applications.length
              : applications.filter((row) => row.verificationStatus === item.value)
                  .length;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={`rounded-full px-4 py-2 text-sm font-bold ${
                filter === item.value
                  ? "bg-brand text-white"
                  : "bg-mint text-brand"
              }`}
            >
              {item.label} ({count})
            </button>
          );
        })}
      </div>
    {visible.length === 0 ? (
      <p className="rounded-[2rem] bg-gold px-5 py-4 font-semibold text-brand">
        No applications in this status.
      </p>
    ) : (
    <ul className="grid gap-4">
      {visible.map((application) => (
        <li
          key={application.userId}
          className="rounded-[2rem] border border-line bg-surface p-5 shadow-[var(--shadow-card)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-brand">
                {application.displayName}
              </h2>
              <p className="text-sm text-muted">
                {application.email} · {application.country ?? "No country"} ·{" "}
                {applicationStatusLabel(application.verificationStatus)}
                {application.status
                  ? ` · Sign-in ${application.status}`
                  : ""}
              </p>
              {application.headline ? (
                <p className="mt-2 font-semibold text-brand">
                  {application.headline}
                </p>
              ) : null}
              <p className="mt-2 text-xs font-bold text-brand-soft">
                {application.subjects.join(" · ") || "No subjects"}
                {application.languages ? ` · ${application.languages}` : ""}
                {` · ${application.stats.ratingLabel} · ${application.stats.reliability.label}`}
              </p>
              {application.rate ? (
                <div className="mt-3 max-w-sm">
                  <TeacherRateBreakdown
                    rate={application.rate}
                    compact
                    revealInternalPayment
                  />
                </div>
              ) : null}
            </div>
            <Link
              href={`/staff/teachers/${application.userId}`}
              className="inline-flex min-h-11 items-center rounded-full bg-brand px-4 text-sm font-bold text-white"
            >
              Open application
            </Link>
          </div>
          <ul className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
            <ChecklistBadge
              label="Identity"
              status={application.checklist.identityStatus}
              done={application.checklist.identityVerified}
            />
            <ChecklistBadge
              label="Qualification"
              status={application.checklist.qualificationStatus}
              done={application.checklist.qualificationVerified}
            />
            <ChecklistBadge
              label="Intro video"
              status={application.checklist.videoStatus}
              done={application.checklist.videoVerified}
            />
            <ChecklistBadge
              label="Agreement"
              done={Boolean(application.agreement?.current)}
            />
          </ul>
          {application.documents.length || application.video ? (
            <p className="mt-3 text-sm font-semibold text-brand">
              {application.documents.length
                ? `${application.documents.length} document${application.documents.length === 1 ? "" : "s"} attached`
                : "No identity or qualification files yet"}
              {application.video ? " · Introduction video attached" : ""}
            </p>
          ) : null}
          {application.interview ? (
            <p className="mt-3 text-sm font-semibold text-brand">
              {interviewStatusLabel(application.interview.status)}
              {application.interview.scheduledAt
                ? ` · ${formatInterviewTime(application.interview.scheduledAt)}`
                : ""}
            </p>
          ) : null}
          <p className="mt-3 text-sm text-muted">
            {application.verificationStatus === "approved" &&
            !application.checklist.videoVerified
              ? "A new introduction video is waiting for review."
              : application.verificationStatus === "suspended"
                ? "This teacher is suspended and hidden from families until restored."
                : application.verificationStatus === "rejected"
                  ? "Application rejected. The teacher can update and submit again."
                  : application.verificationStatus === "approved"
                    ? "Approved and visible to families."
                    : application.checklist.readyToApprove
                      ? "Document verification is complete."
                      : application.checklist.awaitingReview
                        ? "Documents are attached. Open the application and mark identity, qualification, and the introduction video as verified."
                        : "Identity, qualification, and the introduction video must each be uploaded, then verified, before this application can be approved."}
          </p>
        </li>
      ))}
    </ul>
    )}
    </div>
  );
}

export function TeacherVerification({
  application: initial,
  canReview,
  canSeeDocuments,
}: {
  application: TeacherApplication;
  canReview: boolean;
  canSeeDocuments: boolean;
}) {
  const [application, setApplication] = useState(initial);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function reviewDocument(
    fileId: string,
    status: "verified" | "rejected" | "more_info" | "pending",
    note: string,
  ) {
    setPending(true);
    setError("");
    try {
      const updated = await patchJson<TeacherApplication>(
        `/api/v1/staff/teachers/documents/${fileId}`,
        { status, note },
      );
      setApplication(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not review document");
    } finally {
      setPending(false);
    }
  }

  const reviewable = !["approved", "suspended"].includes(
    application.verificationStatus,
  );
  const videoReviewable = application.verificationStatus !== "suspended";

  return (
    <div>
      {error ? (
        <p className="mb-4 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
      <p className="text-sm text-muted">
        {application.email} · {application.country ?? "No country"} ·{" "}
        {applicationStatusLabel(application.verificationStatus)}
        {application.status ? ` · Sign-in ${application.status}` : ""}
      </p>
      {application.headline ? (
        <p className="mt-3 font-semibold text-brand">{application.headline}</p>
      ) : null}
      {application.bio ? (
        <p className="mt-2 text-sm text-muted">{application.bio}</p>
      ) : null}
      <p className="mt-2 text-xs font-bold text-brand-soft">
        {application.subjects.join(" · ") || "No subjects"}
        {application.languages ? ` · ${application.languages}` : ""}
      </p>
      <ul className="mt-6 flex flex-wrap gap-2 text-xs font-bold">
        <ChecklistBadge
          label="Identity"
          status={application.checklist.identityStatus}
          done={application.checklist.identityVerified}
        />
        <ChecklistBadge
          label="Qualification"
          status={application.checklist.qualificationStatus}
          done={application.checklist.qualificationVerified}
        />
        <ChecklistBadge
          label="Intro video"
          status={application.checklist.videoStatus}
          done={application.checklist.videoVerified}
        />
        <ChecklistBadge
          label="Agreement"
          done={Boolean(application.agreement?.current)}
        />
      </ul>
      <div className="mt-6 rounded-[2rem] bg-mint/50 p-5">
        <TeacherStatsPanel stats={application.stats} compact />
      </div>
      {canReview ? (
        <>
          <TeacherRateForm application={application} onUpdated={setApplication} />
          <TeacherPricingControlForm
            application={application}
            onUpdated={setApplication}
          />
          <TeacherStatsForm application={application} onUpdated={setApplication} />
        </>
      ) : null}
      <div className="mt-6 grid gap-4">
        {application.agreement ? (
          <TeacherAgreementRecord record={application.agreement} staff />
        ) : (
          <p className="rounded-[2rem] bg-gold px-5 py-4 font-semibold text-brand">
            Agreement not signed
          </p>
        )}
        {application.agreements
          ?.filter((item) => item.id !== application.agreement?.id)
          .map((record) => (
            <TeacherAgreementRecord
              key={record.id}
              record={record}
              staff
              highlightOutdated={false}
            />
          ))}
      </div>
      {application.events?.length ? (
        <ol className="mt-6 space-y-2 rounded-[2rem] bg-mint/50 px-5 py-4">
          {application.events.map((event) => (
            <li key={event.id} className="text-sm text-brand">
              <span className="font-extrabold">
                {applicationEventLabel(event.kind)}
              </span>
              {event.toStatus ? ` · ${applicationStatusLabel(event.toStatus)}` : ""}
              {event.note ? ` · ${event.note}` : ""}
            </li>
          ))}
        </ol>
      ) : null}
      {canReview ? (
        <InterviewPanel
          application={application}
          disabled={pending}
          onUpdated={setApplication}
          onError={setError}
          onPending={setPending}
        />
      ) : null}
      {canSeeDocuments ? (
        <ul className="mt-6 grid gap-4">
          {application.documents.map((doc) => (
            <DocumentReviewCard
              key={doc.id}
              document={doc}
              disabled={pending || !reviewable}
              onReview={reviewDocument}
            />
          ))}
          {application.video ? (
            <DocumentReviewCard
              document={application.video}
              disabled={pending || !videoReviewable}
              onReview={reviewDocument}
            />
          ) : (
            <li className="rounded-[2rem] border border-line bg-surface p-5 font-semibold text-brand">
              No introduction video
            </li>
          )}
        </ul>
      ) : (
        <p className="mt-6 rounded-[2rem] bg-gold px-5 py-4 font-semibold text-brand">
          You can see verification status, but document links require
          teachers.documents.review.
        </p>
      )}
      {canReview ? (
        <TeacherDecisionPanel
          application={application}
          pending={pending}
          error={error}
          onUpdated={setApplication}
          onError={setError}
          onPending={setPending}
        />
      ) : null}
    </div>
  );
}

function TeacherDecisionPanel({
  application,
  pending,
  error,
  onUpdated,
  onError,
  onPending,
}: {
  application: TeacherApplication;
  pending: boolean;
  error: string;
  onUpdated: (application: TeacherApplication) => void;
  onError: (message: string) => void;
  onPending: (value: boolean) => void;
}) {
  const status = application.verificationStatus;

  async function decide(action: string, note: string) {
    onPending(true);
    onError("");
    try {
      onUpdated(
        await patchJson<TeacherApplication>(
          `/api/v1/staff/teachers/${application.userId}`,
          { action, note },
        ),
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not update status");
    } finally {
      onPending(false);
    }
  }

  return (
    <form
      className="mt-8 rounded-[2rem] border border-line bg-surface p-5 shadow-[var(--shadow-card)]"
      onSubmit={async (event) => {
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        const form = new FormData(
          event.currentTarget,
          submitter instanceof HTMLElement ? submitter : null,
        );
        await decide(
          String(
            (submitter instanceof HTMLButtonElement && submitter.value) ||
              form.get("action") ||
              "",
          ),
          String(form.get("note") ?? ""),
        );
      }}
    >
      <h3 className="font-extrabold text-brand">Decision</h3>
      {error ? (
        <p className="mt-3 rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
      <p className="mt-2 text-sm text-muted">
        {status === "approved"
          ? "Suspend removes the teacher from families and blocks sign-in until you restore them."
          : status === "suspended"
            ? "Restore makes the teacher active and visible again."
            : status === "rejected"
              ? "The teacher can sign in, update the application, and submit again. Reopen asks them to update documents first."
              : "Approve after documents and the introduction video are verified. Reject keeps the account able to sign in and resubmit."}
      </p>
      <input
        name="note"
        className={`${fieldClass} mt-4`}
        placeholder={
          status === "approved" || status === "rejected" || reviewNeedsNote(status)
            ? "Note for the teacher (required to reject or suspend)"
            : "Optional note to the teacher"
        }
      />
      <div className="mt-4 flex flex-wrap gap-2">
        {status === "approved" ? (
            <Button type="submit" name="action" value="suspend" disabled={pending}>
            Suspend teacher
          </Button>
        ) : null}
        {status === "suspended" ? (
          <Button type="submit" name="action" value="restore" disabled={pending}>
            Restore teacher
          </Button>
        ) : null}
        {status !== "approved" && status !== "suspended" ? (
          <>
            <Button
              type="submit"
              name="action"
              value="approve"
              disabled={pending || !application.checklist.readyToApprove}
              title={
                application.checklist.readyToApprove
                  ? "Approve this teacher"
                  : "Verify identity, qualification, and the introduction video first"
              }
            >
              Approve
            </Button>
            <Button
              type="submit"
              name="action"
              value="reject"
              variant="secondary"
              disabled={pending}
            >
              Reject
            </Button>
            {status !== "rejected" ? (
              <Button
                type="submit"
                name="action"
                value="interview"
                variant="secondary"
                disabled={pending}
              >
                Request interview
              </Button>
            ) : null}
            {status === "interview_required" ||
            status === "documents_pending" ||
            status === "rejected" ? (
              <Button
                type="submit"
                name="action"
                value="return_review"
                variant="secondary"
                disabled={pending}
              >
                Return to review
              </Button>
            ) : null}
            {status === "rejected" ? (
              <Button
                type="submit"
                name="action"
                value="reopen"
                variant="secondary"
                disabled={pending}
              >
                Reopen for updates
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
      {status !== "approved" &&
      status !== "suspended" &&
      !application.checklist.readyToApprove ? (
        <p className="mt-3 text-sm text-muted">
          Approve stays unavailable until identity, qualification, and the
          introduction video are verified.
        </p>
      ) : null}
    </form>
  );
}

function reviewNeedsNote(status: string) {
  return status !== "approved" && status !== "suspended";
}

function InterviewPanel({
  application,
  disabled,
  onUpdated,
  onError,
  onPending,
}: {
  application: TeacherApplication;
  disabled: boolean;
  onUpdated: (application: TeacherApplication) => void;
  onError: (message: string) => void;
  onPending: (value: boolean) => void;
}) {
  const interview = application.interview;

  async function run(action: () => Promise<TeacherApplication>) {
    onPending(true);
    onError("");
    try {
      onUpdated(await action());
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not update interview");
    } finally {
      onPending(false);
    }
  }

  return (
    <section className="mt-6 rounded-[2rem] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
      <h3 className="font-extrabold text-brand">Interview</h3>
      {interview ? (
        <p className="mt-2 text-sm text-muted">
          {interviewStatusLabel(interview.status)}
          {interview.scheduledAt
            ? ` · ${formatInterviewTime(interview.scheduledAt)}`
            : ""}
          {interview.meetingUrl ? (
            <>
              {" · "}
              <a
                href={interview.meetingUrl}
                className="font-bold underline"
                target="_blank"
                rel="noreferrer"
              >
                Meeting link
              </a>
            </>
          ) : null}
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted">No interview has been requested yet.</p>
      )}
      {application.verificationStatus !== "approved" &&
      application.verificationStatus !== "rejected" &&
      application.verificationStatus !== "suspended" ? (
        <form
          className="mt-4 grid gap-3 md:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const scheduledAt = String(form.get("scheduledAt") ?? "");
            const meetingUrl = String(form.get("meetingUrl") ?? "");
            const note = String(form.get("note") ?? "");
            await run(() =>
              interview
                ? patchJson<TeacherApplication>(
                    `/api/v1/staff/teachers/interviews/${interview.id}`,
                    {
                      action: "schedule",
                      scheduledAt,
                      meetingUrl,
                      note,
                    },
                  )
                : postJson<TeacherApplication>(
                    `/api/v1/staff/teachers/${application.userId}/interviews`,
                    { scheduledAt, meetingUrl, note },
                  ),
            );
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              Date and time
            </span>
            <input
              type="datetime-local"
              name="scheduledAt"
              required
              className={fieldClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-brand">
              https meeting link
            </span>
            <input
              name="meetingUrl"
              required
              className={fieldClass}
              placeholder="https://"
              defaultValue={interview?.meetingUrl ?? ""}
            />
          </label>
          <input
            name="note"
            className={`${fieldClass} md:col-span-2`}
            placeholder="Optional note to the teacher"
          />
          <Button type="submit" disabled={disabled}>
            {interview ? "Update interview time" : "Schedule interview"}
          </Button>
        </form>
      ) : null}
      {interview?.open ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={disabled}
            onClick={() =>
              run(() =>
                patchJson<TeacherApplication>(
                  `/api/v1/staff/teachers/interviews/${interview.id}`,
                  { action: "complete" },
                ),
              )
            }
          >
            Mark complete
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={disabled}
            onClick={() =>
              run(() =>
                patchJson<TeacherApplication>(
                  `/api/v1/staff/teachers/interviews/${interview.id}`,
                  { action: "no_show" },
                ),
              )
            }
          >
            No-show
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={disabled}
            onClick={() =>
              run(() =>
                patchJson<TeacherApplication>(
                  `/api/v1/staff/teachers/interviews/${interview.id}`,
                  { action: "cancel" },
                ),
              )
            }
          >
            Cancel interview
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function ChecklistBadge({
  label,
  done,
  status,
}: {
  label: string;
  done: boolean;
  status?: "verified" | "pending" | "rejected" | "missing";
}) {
  const resolved = status ?? (done ? "verified" : "missing");
  return (
    <li className={`rounded-full px-3 py-1 ${checklistReviewClass(resolved)}`}>
      {label}: {checklistReviewLabels[resolved]}
    </li>
  );
}

function DocumentReviewCard({
  document: doc,
  disabled,
  onReview,
}: {
  document: TeacherDocument;
  disabled: boolean;
  onReview: (
    fileId: string,
    status: "verified" | "rejected" | "more_info" | "pending",
    note: string,
  ) => Promise<void>;
}) {
  const [note, setNote] = useState(doc.reviewNote ?? "");
  const title =
    doc.purpose === "intro_video"
      ? "Introduction video"
      : `${documentTypeLabel(doc.documentType)} · ${doc.purpose.replaceAll("_", " ")}`;

  return (
    <li className="rounded-[2rem] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
      <h3 className="font-extrabold text-brand">{title}</h3>
      <p className="mt-1 text-sm text-muted">
        {reviewStatusLabel(doc.reviewStatus)}
        {doc.originalName ? ` · ${doc.originalName}` : ""}
        {doc.byteSize ? ` · ${Math.round(doc.byteSize / 1024)} KB` : ""}
      </p>
      {doc.purpose === "intro_video" && (doc.playback || doc.externalUrl) ? (
        <div className="mt-4">
          <IntroVideoPlayer
            playback={doc.playback}
            url={doc.externalUrl}
            title="Teacher introduction video"
          />
        </div>
      ) : doc.externalUrl ? (
        <a
          href={doc.externalUrl}
          className="mt-2 inline-block text-sm font-bold underline"
          target="_blank"
          rel="noreferrer"
        >
          Open document
        </a>
      ) : (
        <p className="mt-2 text-sm text-muted">File record only, no https link</p>
      )}
      {doc.reviewNote ? (
        <p className="mt-2 text-sm font-semibold text-brand">
          Last note: {doc.reviewNote}
        </p>
      ) : null}
      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-bold text-brand">
          Reviewer note
        </span>
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={disabled}
          className={fieldClass}
          placeholder="Optional note if you reject or request more information"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={disabled || doc.reviewStatus === "verified"}
          onClick={() => onReview(doc.id, "verified", note)}
        >
          Verify
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => onReview(doc.id, "more_info", note)}
        >
          Request more info
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          onClick={() => onReview(doc.id, "rejected", note)}
        >
          Reject
        </Button>
      </div>
    </li>
  );
}
