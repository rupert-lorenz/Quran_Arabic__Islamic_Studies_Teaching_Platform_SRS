import { CurrenciesFacultyView } from "@/components/finance/currencies-faculty";
import { StaffCurrencies } from "@/components/staff/staff-currencies";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { requireStaffPage } from "@/server/rbac/guard";
import { listCurrencyWorkspace } from "@/server/staff/currencies";

export const metadata = {
  title: "Multiple currencies",
};

export default async function StaffCurrenciesPage() {
  const access = await requireStaffPage(["settings.write", "payments.read"]);
  const [{ t }, workspace] = await Promise.all([
    getI18n(),
    listCurrencyWorkspace({
      userId: access.user.id,
      roleKey: access.user.roleKey,
      permissions: access.permissions,
    }),
  ]);

  return (
    <>
      <PageHero
        eyebrow={t("currency.faculty.eyebrow")}
        title={t("currency.faculty.title")}
        description={t("currency.faculty.page_help")}
      />
      <Container className="space-y-8 py-10">
        <CurrenciesFacultyView faculty={workspace.faculty} />
        <StaffCurrencies initial={workspace} />
      </Container>
    </>
  );
}
