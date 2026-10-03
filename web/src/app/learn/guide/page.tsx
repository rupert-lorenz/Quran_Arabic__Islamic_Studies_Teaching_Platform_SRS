import Link from "next/link";
import { DocumentBody } from "@/components/docs/document-body";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { documentBlocks } from "@/server/docs/content";
import { getI18n } from "@/server/i18n/locale";
import { requireStudent } from "@/server/rbac/guard";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("dc.student.title"), description: t("dc.student.help") };
}

export default async function StudentGuidePage() {
  const { t, locale } = await getI18n();
  await requireStudent();

  return (
    <PublicShell>
      <Container className="space-y-8 py-10">
        <DocumentBody
          title={t("dc.student.title")}
          help={t("dc.student.help")}
          blocks={documentBlocks("student", locale.code)}
        />
        <p className="text-sm">
          <Link href="/learn" className="font-bold text-brand-accent underline">
            {t("dc.back.student")}
          </Link>
        </p>
      </Container>
    </PublicShell>
  );
}
