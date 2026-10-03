import Link from "next/link";
import { DocumentationFacultiesView } from "@/components/docs/documentation-faculties";
import { Container } from "@/components/ui/container";
import { getI18n } from "@/server/i18n/locale";
import { requireStaffPage } from "@/server/rbac/guard";
import { getDocumentationFaculties } from "@/server/docs/faculties";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("dc.page.title"), description: t("dc.page.help") };
}

export default async function StaffDocsPage() {
  const { t } = await getI18n();
  await requireStaffPage();
  const faculties = getDocumentationFaculties();

  return (
    <Container className="space-y-8 py-10">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-brand">
          {t("dc.page.title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t("dc.page.help")}</p>
      </div>
      <DocumentationFacultiesView faculties={faculties} />
      <p className="text-sm">
        <Link href="/staff" className="font-bold text-brand-accent underline">
          {t("dc.back.staff")}
        </Link>
      </p>
    </Container>
  );
}
