import { TestingFacultiesView } from "@/components/testing/testing-faculties";
import { Container } from "@/components/ui/container";
import { hasAnyPermission } from "@/lib/rbac";
import { getI18n } from "@/server/i18n/locale";
import { requireStaffPage } from "@/server/rbac/guard";
import { getTestingFaculties } from "@/server/testing/faculties";
import { ensureUatAccounts } from "@/server/testing/uat-accounts";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("tq.page.title"), description: t("tq.page.help") };
}

export default async function StaffTestingPage() {
  const { t } = await getI18n();
  const access = await requireStaffPage();
  const canWrite = hasAnyPermission(access, "users.write");
  if (canWrite) await ensureUatAccounts();
  const faculties = await getTestingFaculties();

  return (
    <Container className="space-y-8 py-10">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-brand">
          {t("tq.page.title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t("tq.page.help")}</p>
      </div>
      <TestingFacultiesView
        faculties={faculties}
        showIdentity
        showPasswordForm={canWrite}
      />
    </Container>
  );
}
