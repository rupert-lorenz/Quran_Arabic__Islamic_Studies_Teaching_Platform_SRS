"use client";

import Link from "next/link";
import { TeacherRateBreakdown } from "@/components/teachers/teacher-rate-breakdown";
import { TeacherStatsPanel } from "@/components/teachers/teacher-stats-panel";
import {
  checklistReviewClass,
  checklistReviewLabels,
} from "@/lib/teacher-documents";
import type { TeacherRateView } from "@/lib/teacher-rate-display";
import type { TeacherStats } from "@/lib/teacher-reputation";
import {
  applicationEventLabel,
  applicationStatusLabel,
  formatInterviewTime,
  interviewStatusLabel,
  teacherStatusMessage,
  teacherStatusNextStep,
  verificationChecklistItems,
} from "@/lib/teacher-status";

export type TeacherVerificationSummary = {
  displayName: string;
  email: string;
  verificationStatus: string;
  reviewNote: string | null;
  submittedAt: string | Date | null;
  reviewedAt: string | Date | null;
  videoAwaitingReview: boolean;
  steps: {
    profile: boolean;
    documents: boolean;
    video: boolean;
    agreement: boolean;
  };
  readyToSubmit: boolean;
  verification: {
    identityVerified: boolean;
    qualificationVerified: boolean;
    videoVerified: boolean;
    identityStatus?: "verified" | "pending" | "rejected" | "missing";
    qualificationStatus?: "verified" | "pending" | "rejected" | "missing";
    videoStatus?: "verified" | "pending" | "rejected" | "missing";
    agreementCurrent: boolean;
    awaitingReview: boolean;
    needsReplacement: boolean;
  };
  interview: {
    status: string;
    scheduledAt: string | Date | null;
    meetingUrl: string | null;
    staffNote: string | null;
  } | null;
  events: {
    id: string;
    kind: string;
    toStatus: string | null;
    note: string | null;
  }[];
  stats: TeacherStats;
  rate?: TeacherRateView | null;
};

function ChecklistBadge({
  label,
  status,
}: {
  label: string;
  status: "verified" | "pending" | "rejected" | "missing";
}) {
  return (
    <li className={`rounded-full px-3 py-1 ${checklistReviewClass(status)}`}>
      {label}
      {" · "}
      {status === "verified"
        ? "Done"
        : status === "pending"
          ? "Awaiting review"
          : status === "rejected"
            ? "Needs replacement"
            : "Needed"}
    </li>
  );
}

export function TeacherVerificationStatus({
  summary,
}: {
  summary: TeacherVerificationSummary;
}) {
  const next = teacherStatusNextStep(
    summary.verificationStatus,
    summary.readyToSubmit,
  );
  const submittedAt = summary.submittedAt
    ? new Date(summary.submittedAt)
    : null;
  const reviewedAt = summary.reviewedAt ? new Date(summary.reviewedAt) : null;

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <p className="text-xs font-bold uppercase text-brand-soft">
          Verification status
        </p>
        <h2 className="mt-1 text-2xl font-extrabold text-brand">
          {applicationStatusLabel(summary.verificationStatus)}
        </h2>
        <p className="mt-3 font-semibold text-brand">
          {teacherStatusMessage(summary.verificationStatus, {
            videoAwaitingReview: summary.videoAwaitingReview,
          })}
        </p>
        <p className="mt-2 text-sm text-muted">
          {summary.displayName} · {summary.email}
          {submittedAt ? ` · Submitted ${submittedAt.toLocaleDateString("en-GB")}` : ""}
          {reviewedAt ? ` · Reviewed ${reviewedAt.toLocaleDateString("en-GB")}` : ""}
        </p>
        {summary.reviewNote ? (
          <p className="mt-4 rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-brand">
            Staff note: {summary.reviewNote}
          </p>
        ) : null}
        <p className="mt-5">
          <Link href="/teach/home" className="font-bold text-brand underline">
            Teacher dashboard
          </Link>
          {" · "}
          <Link href={next.href} className="font-bold text-brand underline">
            {next.label}
          </Link>
          {summary.verificationStatus === "approved" ? (
            <>
              {" · "}
              <Link href="/teach/video" className="font-bold text-brand underline">
                Introduction video
              </Link>
              {" · "}
              <Link href="/teachers" className="font-bold text-brand underline">
                Marketplace
              </Link>
            </>
          ) : null}
        </p>
      </section>

      {summary.verificationStatus === "approved" ? (
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h3 className="text-xl font-extrabold text-brand">
            Public reputation
          </h3>
          <p className="mt-2 text-sm text-muted">
            Families see these ratings and reliability indicators on your
            marketplace profile.
          </p>
          <div className="mt-4">
            <TeacherStatsPanel stats={summary.stats} />
          </div>
          {summary.rate ? (
            <div className="mt-4 rounded-[1.5rem] bg-mint/60 p-4">
              <TeacherRateBreakdown
                rate={summary.rate}
                revealInternalPayment
                title="Listed price split"
              />
            </div>
          ) : (
            <p className="mt-4 text-sm font-semibold text-brand">
              Set your hourly rate on your teaching profile to show families a
              student price and your net earnings.
            </p>
          )}
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <h3 className="text-xl font-extrabold text-brand">Checklist</h3>
        <p className="mt-2 text-sm text-muted">
          Submitted items and staff verification. Approval needs a verified
          identity document, qualification, and introduction video.
        </p>
        <ul className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
          {verificationChecklistItems.map((item) => {
            const status =
              item.key === "profile"
                ? summary.steps.profile
                  ? "verified"
                  : "missing"
                : item.key === "identity"
                  ? summary.verification.identityStatus ??
                    (summary.verification.identityVerified ? "verified" : "missing")
                  : item.key === "qualification"
                    ? summary.verification.qualificationStatus ??
                      (summary.verification.qualificationVerified
                        ? "verified"
                        : "missing")
                    : item.key === "video"
                      ? summary.verification.videoStatus ??
                        (summary.verification.videoVerified ? "verified" : "missing")
                      : summary.verification.agreementCurrent
                        ? "verified"
                        : "missing";
            return <ChecklistBadge key={item.key} label={item.label} status={status} />;
          })}
        </ul>
        {summary.verification.awaitingReview ? (
          <p className="mt-4 text-sm font-semibold text-brand">
            Staff still have items waiting for review.
          </p>
        ) : null}
        {summary.verification.needsReplacement ? (
          <p className="mt-2 text-sm font-semibold text-brand">
            At least one document or video needs a replacement.
          </p>
        ) : null}
      </section>

      {summary.interview ? (
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h3 className="text-xl font-extrabold text-brand">Interview</h3>
          <p className="mt-2 font-semibold text-brand">
            {interviewStatusLabel(summary.interview.status)}
            {summary.interview.scheduledAt
              ? ` · ${formatInterviewTime(summary.interview.scheduledAt)}`
              : ""}
          </p>
          {summary.interview.meetingUrl ? (
            <p className="mt-2">
              <a
                href={summary.interview.meetingUrl}
                className="font-bold text-brand underline"
                target="_blank"
                rel="noreferrer"
              >
                Open meeting link
              </a>
            </p>
          ) : null}
          {summary.interview.staffNote ? (
            <p className="mt-2 text-sm text-muted">
              Staff note: {summary.interview.staffNote}
            </p>
          ) : null}
        </section>
      ) : null}

      {summary.events.length ? (
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h3 className="text-xl font-extrabold text-brand">Recent updates</h3>
          <ol className="mt-4 space-y-2">
            {summary.events.map((event) => (
              <li key={event.id} className="text-sm text-muted">
                <span className="font-bold text-brand">
                  {applicationEventLabel(event.kind)}
                </span>
                {event.toStatus
                  ? ` · ${applicationStatusLabel(event.toStatus)}`
                  : ""}
                {event.note ? ` · ${event.note}` : ""}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
