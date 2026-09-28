import { CommissionRulesFacultyView } from "@/components/finance/commission-rules-faculty";
import { CommissionScopedFacultyView } from "@/components/finance/commission-scoped-faculty";
import { LocationPriceFacultyView } from "@/components/finance/location-price-faculty";
import { StaffRatesClient } from "@/components/staff/staff-rates-client";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { hasAnyPermission } from "@/lib/rbac";
import { getI18n } from "@/server/i18n/locale";
import { getCommissionRulesFaculty } from "@/server/finance/commission-rules";
import { getCommissionScopedFaculty } from "@/server/finance/commission-scoped";
import { getLocationPriceFaculty } from "@/server/finance/location-prices";
import { requireStaffPage } from "@/server/rbac/guard";
import { getTeacherRatePolicy } from "@/server/staff/rates";

export const metadata = {
  title: "Market and location prices",
};

export default async function StaffRatesPage() {
  const access = await requireStaffPage([
    "settings.write",
    "teachers.approve",
    "payments.read",
  ]);
  const actor = {
    userId: access.user.id,
    roleKey: access.user.roleKey,
    permissions: access.permissions,
  };
  const [{ t }, policy, faculty, commissionRules, commissionScoped] =
    await Promise.all([
      getI18n(),
      getTeacherRatePolicy(),
      getLocationPriceFaculty(),
      getCommissionRulesFaculty(actor),
      getCommissionScopedFaculty(actor),
    ]);
  const canEdit = hasAnyPermission(access, [
    "settings.write",
    "teachers.approve",
  ]);

  return (
    <>
      <PageHero
        eyebrow={t("price.faculty.eyebrow")}
        title={t("price.faculty.title")}
        description={t("price.faculty.page_help")}
      />
      <Container className="space-y-8 py-10">
        <LocationPriceFacultyView faculty={faculty} />
        <CommissionRulesFacultyView faculty={commissionRules} />
        <CommissionScopedFacultyView faculty={commissionScoped} />
        <StaffRatesClient initial={policy} canEdit={canEdit} />
      </Container>
    </>
  );
}
