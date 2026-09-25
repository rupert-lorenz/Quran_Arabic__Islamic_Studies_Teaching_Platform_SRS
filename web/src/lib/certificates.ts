export const CERTIFICATE_STATUSES = ["draft", "active", "retired"] as const;
export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];

export const CERTIFICATE_AWARD_KINDS = ["exam", "quiz", "course", "manual"] as const;
export type CertificateAwardKind = (typeof CERTIFICATE_AWARD_KINDS)[number];

export const CERTIFICATE_DEFAULT_HEADING = "Certificate of completion";
export const CERTIFICATE_DEFAULT_BODY =
  "This certifies that {student} has successfully completed {title}.";
export const CERTIFICATE_DEFAULT_SIGN_OFF = "Al Haramain Schools";

export function isCertificateAwardKind(
  value: string,
): value is CertificateAwardKind {
  return (CERTIFICATE_AWARD_KINDS as readonly string[]).includes(value);
}

export function certificatesHref(
  roleKey: string,
  isStaff: boolean,
  studentUserId?: string,
) {
  const base =
    roleKey === "student"
      ? "/learn/certificates"
      : roleKey === "parent"
        ? "/family/certificates"
        : roleKey === "teacher"
          ? "/teach/certificates"
          : isStaff
            ? "/staff/academic/certificates"
            : "/learn/certificates";
  if (!studentUserId || roleKey === "student") return base;
  return `${base}?student=${studentUserId}`;
}

export function certificateAwardHref(
  roleKey: string,
  isStaff: boolean,
  awardId: string,
) {
  const base =
    roleKey === "student"
      ? "/learn/certificates"
      : roleKey === "parent"
        ? "/family/certificates"
        : roleKey === "teacher"
          ? "/teach/certificates"
          : isStaff
            ? "/staff/academic/certificates"
            : "/learn/certificates";
  return `${base}/${awardId}`;
}

export function familyChildCertificatesHref(studentUserId: string) {
  return `/family/children/${studentUserId}/certificates`;
}

export function renderCertificateBody(
  template: string,
  vars: {
    student: string;
    title: string;
    subject: string;
    date: string;
    school?: string;
  },
) {
  return template
    .replaceAll("{student}", vars.student)
    .replaceAll("{title}", vars.title)
    .replaceAll("{subject}", vars.subject)
    .replaceAll("{date}", vars.date)
    .replaceAll("{school}", vars.school ?? CERTIFICATE_DEFAULT_SIGN_OFF);
}
