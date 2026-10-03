import Link from "next/link";
import { DocumentBody } from "@/components/docs/document-body";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { documentBlocks } from "@/server/docs/content";
import { getI18n } from "@/server/i18n/locale";
import { requireTeacher } from "@/server/rbac/guard";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("dc.teacher.title"), description: t("dc.teacher.help") };
}

export default async function TeacherGuidePage() {
  const { t, locale } = await getI18n();
  await requireTeacher();

  return (
    <TeacherWorkspaceShell>
      <Container className="space-y-8 py-10">
        <DocumentBody
          title={t("dc.teacher.title")}
          help={t("dc.teacher.help")}
          blocks={documentBlocks("teacher", locale.code)}
        />
        <p className="text-sm">
          <Link href="/teach/home" className="font-bold text-brand-accent underline">
            {t("dc.back.teacher")}
          </Link>
        </p>
      </Container>
    </TeacherWorkspaceShell>
  );
}
