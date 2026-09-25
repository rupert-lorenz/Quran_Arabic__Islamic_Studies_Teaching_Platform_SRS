import { CertificateDeskView } from "@/components/lms/certificate-desk";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getCertificateDesk } from "@/server/lms/certificates";
import { requireParent } from "@/server/rbac/guard";

export const metadata = {
  title: "Certificates",
};

export default async function FamilyCertificatesPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>;
}) {
  const access = await requireParent();
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
    <PublicShell>
      <PageHero
        eyebrow={t("cert.eyebrow")}
        title={t("cert.title")}
        description={t("cert.family_help")}
      />
      <Container className="py-10">
        <CertificateDeskView initial={desk} />
      </Container>
    </PublicShell>
  );
}
