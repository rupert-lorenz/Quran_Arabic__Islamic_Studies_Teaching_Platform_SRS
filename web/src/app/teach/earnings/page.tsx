import { PaymentsFinanceDeskView } from "@/components/finance/payments-finance-desk";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { getPaymentsFinanceDesk } from "@/server/finance/service";
import { requireApprovedTeacher } from "@/server/rbac/guard";

export const metadata = {
  title: "Earnings",
};

export default async function TeacherEarningsPage() {
  const access = await requireApprovedTeacher();
  const [{ t }, desk] = await Promise.all([
    getI18n(),
    getPaymentsFinanceDesk({
      userId: access.user.id,
      roleKey: access.user.roleKey,
      permissions: access.permissions,
    }),
  ]);

  return (
    <TeacherWorkspaceShell>
      <PageHero
        eyebrow={t("pay.eyebrow")}
        title={t("pay.earnings.title")}
        description={t("pay.teacher_help")}
      />
      <Container className="py-10">
        <PaymentsFinanceDeskView desk={desk} />
      </Container>
    </TeacherWorkspaceShell>
  );
}
