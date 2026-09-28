import { PaymentsFinanceDeskView } from "@/components/finance/payments-finance-desk";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getPaymentsFinanceDesk } from "@/server/finance/service";
import { requireStaffPage } from "@/server/rbac/guard";

export const metadata = {
  title: "Payments & Marketplace Finance",
};

export default async function StaffFinancePage() {
  const access = await requireStaffPage("payments.read");
  const [{ t }, desk] = await Promise.all([
    getI18n(),
    getPaymentsFinanceDesk({
      userId: access.user.id,
      roleKey: access.user.roleKey,
      permissions: access.permissions,
    }),
  ]);

  return (
    <>
      <PageHero
        eyebrow={t("pay.eyebrow")}
        title={t("pay.title")}
        description={t("pay.help")}
      />
      <Container className="py-10">
        <PaymentsFinanceDeskView desk={desk} />
      </Container>
    </>
  );
}
