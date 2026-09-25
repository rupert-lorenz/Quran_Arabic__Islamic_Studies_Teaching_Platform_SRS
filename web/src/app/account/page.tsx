import { AccountSettings } from "@/components/account/account-settings";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { publicUser } from "@/server/auth/login";
import { getAccessContext } from "@/server/rbac/guard";
import { getI18n } from "@/server/i18n/locale";
import { getRequestMoney } from "@/server/money/currency";
import { resolveDisplayTimeZone } from "@/server/booking/policy";
import { timezoneOptions } from "@/lib/geo";
import { getTeacherVerificationSummary } from "@/server/teacher/onboarding";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Account",
};

export default async function AccountPage() {
  const access = await getAccessContext();
  if (!access) {
    redirect("/login");
  }
  if (access.twoFactorPending) {
    redirect("/account/security");
  }
  if (access.teacherOnboardingRequired) {
    redirect("/teach/onboarding");
  }

  const account = publicUser(
    access.user,
    access.permissions,
    { twoFactorEnabled: access.twoFactorEnabled },
  );
  const [teacherVerification, i18n, money, timeZone] = await Promise.all([
    access.user.roleKey === "teacher"
      ? getTeacherVerificationSummary(access.user.id)
      : null,
    getI18n(),
    getRequestMoney(),
    resolveDisplayTimeZone(access.user.id),
  ]);

  return (
    <PublicShell>
      <PageHero
        eyebrow={i18n.t("account.eyebrow")}
        title={i18n.t("account.hello", { name: account.displayName })}
        description={i18n.t("account.description")}
      />
      <Container className="py-10">
        <AccountSettings
          {...account}
          verificationStatus={teacherVerification?.verificationStatus}
          videoAwaitingReview={teacherVerification?.videoAwaitingReview}
          locales={i18n.locales}
          locale={i18n.locale.code}
          languageLabel={i18n.t("language.label")}
          currencies={money.currencies}
          currency={money.currency.code}
          currencyLabel={i18n.t("currency.label")}
          timeZone={timeZone}
          timezones={timezoneOptions(timeZone)}
          timezoneLabel={i18n.t("timezone.label")}
        />
      </Container>
    </PublicShell>
  );
}
