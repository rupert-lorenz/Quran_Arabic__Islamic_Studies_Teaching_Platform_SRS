export const identityDocumentTypes = [
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID" },
  { value: "residence_permit", label: "Residence permit" },
  { value: "other", label: "Other identity" },
] as const;

export const qualificationDocumentTypes = [
  { value: "ijazah", label: "Ijazah" },
  { value: "degree", label: "Degree" },
  { value: "teaching_certificate", label: "Teaching certificate" },
  { value: "other", label: "Other qualification" },
] as const;

const documentTypeLabels: Record<string, string> = {
  passport: "Passport",
  national_id: "National ID",
  residence_permit: "Residence permit",
  ijazah: "Ijazah",
  degree: "Degree",
  teaching_certificate: "Teaching certificate",
  other: "Other",
};

const reviewStatusLabels: Record<string, string> = {
  pending: "Awaiting review",
  verified: "Verified",
  rejected: "Rejected",
  more_info: "More information requested",
};

export function documentTypeLabel(value: string | null | undefined) {
  return value ? documentTypeLabels[value] ?? value.replaceAll("_", " ") : "Document";
}

export function reviewStatusLabel(value: string | null | undefined) {
  return value ? reviewStatusLabels[value] ?? value.replaceAll("_", " ") : "Awaiting review";
}

export const checklistReviewLabels = {
  verified: "verified",
  pending: "awaiting review",
  rejected: "needs replacement",
  missing: "not uploaded",
} as const;

export function checklistReviewClass(status: keyof typeof checklistReviewLabels) {
  if (status === "verified") {
    return "bg-mint text-brand";
  }
  if (status === "pending") {
    return "bg-gold text-brand";
  }
  if (status === "rejected") {
    return "bg-rose text-brand";
  }
  return "bg-surface text-muted";
}

export function documentTypesForPurpose(purpose: "identity" | "qualification") {
  return purpose === "identity" ? identityDocumentTypes : qualificationDocumentTypes;
}
