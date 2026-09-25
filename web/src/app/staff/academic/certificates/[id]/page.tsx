import Link from "next/link";
import { notFound } from "next/navigation";
import { CertificateDocument } from "@/components/lms/certificate-document";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { ApiError } from "@/server/api/errors";
import { getI18n } from "@/server/i18n/locale";
import { getCertificateAward } from "@/server/lms/certificates";
import { requireStaffPage } from "@/server/rbac/guard";

export const metadata = {
  title: "Certificate",
};

export default async function StaffCertificatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireStaffPage([
    "academic.certificates",
    "academic.curriculum",
    "reports.academic",
  ]);
  const { id } = await params;
  const [{ t }, award] = await Promise.all([
    getI18n(),
    getCertificateAward(
      {
        userId: access.user.id,
        roleKey: access.user.roleKey,
        permissions: access.permissions,
      },
      id,
    ).catch((error) => {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }),
  ]);
  if (!award) notFound();

  return (
    <Container className="py-10">
      <PageHero
        eyebrow={t("cert.eyebrow")}
        title={award.heading}
        description={t("cert.help")}
      />
      <p className="mb-6 print:hidden">
        <Link
          href="/staff/academic/certificates"
          className="font-semibold text-brand underline"
        >
          {t("cert.back_staff")}
        </Link>
      </p>
      <CertificateDocument award={award} />
    </Container>
  );
}
