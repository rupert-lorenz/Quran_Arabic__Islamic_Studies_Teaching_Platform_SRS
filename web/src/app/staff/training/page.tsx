import { DocumentationFacultiesView } from "@/components/docs/documentation-faculties";
import { Container } from "@/components/ui/container";
import { getDocumentationFaculties } from "@/server/docs/faculties";
import { getI18n } from "@/server/i18n/locale";
import { requireStaffPage } from "@/server/rbac/guard";
import Link from "next/link";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("tr.summary.title"), description: t("tr.summary.help") };
}

export default async function StaffTrainingPage() {
  const { t } = await getI18n();
  await requireStaffPage();
  const faculties = getDocumentationFaculties();

  return (
    <Container className="space-y-8 py-10">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-brand">
          {t("tr.summary.title")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t("tr.summary.help")}</p>
      </div>
      <DocumentationFacultiesView faculties={faculties} section="training" />
      <p className="text-sm">
        <Link href="/staff/docs" className="font-bold text-brand-accent underline">
          {t("dc.back.docs")}
        </Link>
      </p>
    </Container>
  );
}
