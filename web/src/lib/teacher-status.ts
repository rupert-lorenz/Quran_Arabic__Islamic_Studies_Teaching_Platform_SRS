export const applicationStatusFilters = [
  { value: "all", label: "All" },
  { value: "application_started", label: "Started" },
  { value: "under_review", label: "Under review" },
  { value: "interview_required", label: "Interview" },
  { value: "documents_pending", label: "Documents" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "suspended", label: "Suspended" },
] as const;

const applicationStatusLabels: Record<string, string> = {
  application_started: "Application started",
  documents_pending: "Documents needed",
  under_review: "Under review",
  interview_required: "Interview required",
  approved: "Approved",
  rejected: "Rejected",
  suspended: "Suspended",
};

const interviewStatusLabels: Record<string, string> = {
  requested: "Interview requested",
  scheduled: "Interview scheduled",
  confirmed: "Teacher confirmed",
  completed: "Interview completed",
  no_show: "Teacher did not attend",
  cancelled: "Interview cancelled",
};

const eventKindLabels: Record<string, string> = {
  submitted: "Application submitted",
  status_changed: "Status updated",
  interview_requested: "Interview requested",
  interview_scheduled: "Interview scheduled",
  interview_confirmed: "Teacher confirmed the interview",
  interview_completed: "Interview completed",
  interview_no_show: "Marked as no-show",
  interview_cancelled: "Interview cancelled",
  note_added: "Note added",
  agreement_signed: "Agreement signed",
};

export const publicVerifiedBadgeLabel = "Verified teacher";

export const verificationChecklistItems = [
  { key: "profile", label: "Teaching profile" },
  { key: "identity", label: "Identity" },
  { key: "qualification", label: "Qualification" },
  { key: "video", label: "Introduction video" },
  { key: "agreement", label: "Agreement" },
] as const;

export function teacherStatusMessage(
  status: string | null | undefined,
  extras?: { videoAwaitingReview?: boolean },
) {
  if (status === "approved" && extras?.videoAwaitingReview) {
    return "You are an approved teacher. A new introduction video is waiting for staff review.";
  }

  switch (status) {
    case "application_started":
      return "Start your teaching profile, then add documents, a video, and the agreement.";
    case "documents_pending":
      return "Staff asked you to replace or add documents. Upload a new file, then submit again.";
    case "under_review":
      return "Your application is with staff. You will get an email when they approve, reject, or ask for an interview.";
    case "interview_required":
      return "Staff asked for an interview. Confirm the time if needed, then wait for their decision.";
    case "approved":
      return "Your teacher application is approved. Families can see your public profile.";
    case "rejected":
      return "Staff did not approve this application. Update the items in their note, then submit again.";
    case "suspended":
      return "This teacher account is suspended and hidden from families.";
    default:
      return "Your verification status updates as you submit and staff review your application.";
  }
}

export function teacherStatusNextStep(
  status: string | null | undefined,
  readyToSubmit = false,
) {
  if (status === "approved") {
    return { href: "/teach/profile", label: "Manage profile and rate" };
  }
  if (status === "interview_required") {
    return { href: "/teach/onboarding", label: "View interview details" };
  }
  if (status === "under_review") {
    return { href: "/teach/onboarding", label: "View application" };
  }
  return {
    href: "/teach/onboarding",
    label: readyToSubmit ? "Submit application" : "Continue application",
  };
}

export function applicationStatusLabel(value: string | null | undefined) {
  return value
    ? applicationStatusLabels[value] ?? value.replaceAll("_", " ")
    : "Unknown";
}

export function interviewStatusLabel(value: string | null | undefined) {
  return value
    ? interviewStatusLabels[value] ?? value.replaceAll("_", " ")
    : "No interview";
}

export function applicationEventLabel(value: string | null | undefined) {
  return value
    ? eventKindLabels[value] ?? value.replaceAll("_", " ")
    : "Update";
}

export function formatInterviewTime(value: string | Date | null | undefined) {
  if (!value) {
    return "Time to be confirmed";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Time to be confirmed";
  }
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
