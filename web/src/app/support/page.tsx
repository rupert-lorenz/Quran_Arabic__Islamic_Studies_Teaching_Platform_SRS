import { redirect } from "next/navigation";
import { CrmFacultiesView } from "@/components/crm/crm-faculties";
import { SupportDesk } from "@/components/crm/support-desk";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getCrmFaculties } from "@/server/crm/faculties";
import { listMyTickets } from "@/server/crm/records";
import { getI18n } from "@/server/i18n/locale";
import { getAccessContext } from "@/server/rbac/guard";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("cr.tickets.title") };
}

export default async function SupportPage() {
  const [{ t }, access] = await Promise.all([getI18n(), getAccessContext()]);
  if (!access) redirect("/login");
  if (access.twoFactorPending) redirect("/account/security");
  const actor = {
    userId: access.user.id,
    roleKey: access.user.roleKey,
    permissions: access.permissions,
  };
  const [faculties, mine] = await Promise.all([
    getCrmFaculties(actor),
    listMyTickets(actor),
  ]);

  return (
    <PublicShell>
      <PageHero eyebrow={t("cr.overview.title")} title={t("cr.tickets.title")} description={t("cr.tickets.help")} />
      <Container className="space-y-8 py-10">
        <SupportDesk initial={mine.tickets} />
        <CrmFacultiesView faculties={faculties} />
      </Container>
    </PublicShell>
  );
}
