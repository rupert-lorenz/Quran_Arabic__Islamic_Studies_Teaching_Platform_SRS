import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentBody } from "@/components/docs/document-body";
import { Container } from "@/components/ui/container";
import type { UiMessageKey } from "@/lib/i18n";
import { trainingBlocks, trainingBySlug } from "@/server/docs/training";
import { getI18n } from "@/server/i18n/locale";
import { requireStaffPage } from "@/server/rbac/guard";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = trainingBySlug(slug);
  const { t } = await getI18n();
  if (!course) return { title: t("tr.summary.title") };
  return {
    title: t(`tr.${course.id}.title` as UiMessageKey),
    description: t(`tr.${course.id}.help` as UiMessageKey),
  };
}

export default async function StaffTrainingCoursePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = trainingBySlug(slug);
  if (!course) notFound();
  const { t, locale } = await getI18n();
  await requireStaffPage();

  return (
    <Container className="space-y-8 py-10">
      <DocumentBody
        title={t(`tr.${course.id}.title` as UiMessageKey)}
        help={t(`tr.${course.id}.help` as UiMessageKey)}
        blocks={trainingBlocks(course.id, locale.code)}
      />
      <p className="text-sm">
        <Link href="/staff/training" className="font-bold text-brand-accent underline">
          {t("tr.back")}
        </Link>
      </p>
    </Container>
  );
}
