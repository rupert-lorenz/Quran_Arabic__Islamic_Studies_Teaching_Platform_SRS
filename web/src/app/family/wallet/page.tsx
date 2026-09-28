import { PaymentsFinanceDeskView } from "@/components/finance/payments-finance-desk";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getPaymentsFinanceDesk } from "@/server/finance/service";
import { requireParent } from "@/server/rbac/guard";

export const metadata = {
  title: "Wallet",
};

export default async function FamilyWalletPage() {
  const access = await requireParent();
  const [{ t }, desk] = await Promise.all([
    getI18n(),
    getPaymentsFinanceDesk({
      userId: access.user.id,
      roleKey: access.user.roleKey,
      permissions: access.permissions,
    }),
  ]);

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("pay.eyebrow")}
        title={t("pay.wallet.title")}
        description={t("pay.family_help")}
      />
      <Container className="py-10">
        <PaymentsFinanceDeskView desk={desk} />
      </Container>
    </PublicShell>
  );
}
