import { CertificateDeskView } from "@/components/lms/certificate-desk";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getCertificateDesk } from "@/server/lms/certificates";
import { requireStaffPage } from "@/server/rbac/guard";

export const metadata = {
  title: "Certificates",
};

export default async function StaffCertificatesPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const access = await requireStaffPage([
    "academic.certificates",
    "academic.curriculum",
    "reports.academic",
  ]);
  const { student } = await searchParams;
  const [{ t }, desk] = await Promise.all([
    getI18n(),
    getCertificateDesk(
      {
        userId: access.user.id,
        roleKey: access.user.roleKey,
        permissions: access.permissions,
      },
      { studentUserId: student },
    ),
  ]);

  return (
    <Container className="py-10">
      <PageHero
        eyebrow={t("cert.eyebrow")}
        title={t("cert.title")}
        description={t("cert.help")}
      />
      <CertificateDeskView initial={desk} />
    </Container>
  );
}
