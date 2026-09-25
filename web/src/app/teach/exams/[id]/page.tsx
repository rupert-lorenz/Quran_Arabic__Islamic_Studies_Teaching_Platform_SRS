import Link from "next/link";
import { notFound } from "next/navigation";
import { ExamDetail } from "@/components/lms/exam-detail";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { ApiError } from "@/server/api/errors";
import { getI18n } from "@/server/i18n/locale";
import { getExam, listExamsDesk } from "@/server/lms/exams";
import { listQuestionBank } from "@/server/lms/question-bank";
import { requireApprovedTeacher } from "@/server/rbac/guard";

export const metadata = {
  title: "Exams",
};

export default async function TeacherExamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireApprovedTeacher();
  const { id } = await params;
  const actor = {
    userId: access.user.id,
    roleKey: access.user.roleKey,
    permissions: access.permissions,
  };
  const [{ t }, item, desk, bank] = await Promise.all([
    getI18n(),
    getExam(actor, id).catch((error) => {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }),
    listExamsDesk(actor),
    listQuestionBank(actor),
  ]);
  if (!item) notFound();

  return (
    <TeacherWorkspaceShell>
      <PageHero
        eyebrow={t("exam.eyebrow")}
        title={item.title}
        description={t("exam.help")}
      />
      <Container className="py-10">
        <p className="mb-6 text-sm font-semibold">
          <Link href="/teach/exams" className="text-brand underline">
            {t("exam.back")}
          </Link>
        </p>
        <ExamDetail initial={item} subjects={desk.subjects} bank={bank} />
      </Container>
    </TeacherWorkspaceShell>
  );
}
