import Link from "next/link";
import { notFound } from "next/navigation";
import { ExamDetail } from "@/components/lms/exam-detail";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { ApiError } from "@/server/api/errors";
import { getI18n } from "@/server/i18n/locale";
import { getExam } from "@/server/lms/exams";
import { requireStudent } from "@/server/rbac/guard";

export const metadata = {
  title: "Exams",
};

export default async function StudentExamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireStudent();
  const { id } = await params;
  const [{ t }, item] = await Promise.all([
    getI18n(),
    getExam(
      {
        userId: access.user.id,
        roleKey: access.user.roleKey,
        permissions: access.permissions,
      },
      id,
    ).catch((error) => {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }),
  ]);
  if (!item) notFound();

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("exam.eyebrow")}
        title={item.title}
        description={t("exam.student_help")}
      />
      <Container className="py-10">
        <p className="mb-6 text-sm font-semibold">
          <Link href="/learn/exams" className="text-brand underline">
            {t("exam.back")}
          </Link>
        </p>
        <ExamDetail initial={item} subjects={[]} />
      </Container>
    </PublicShell>
  );
}
