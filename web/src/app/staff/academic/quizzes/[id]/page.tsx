import Link from "next/link";
import { notFound } from "next/navigation";
import { QuizDetail } from "@/components/lms/quiz-detail";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { ApiError } from "@/server/api/errors";
import { getI18n } from "@/server/i18n/locale";
import { listQuestionBank } from "@/server/lms/question-bank";
import { getQuiz, listQuizzesDesk } from "@/server/lms/quizzes";
import { requireStaffPage } from "@/server/rbac/guard";

export const metadata = {
  title: "Quizzes",
};

export default async function StaffQuizDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireStaffPage(["academic.curriculum"]);
  const { id } = await params;
  const actor = {
    userId: access.user.id,
    roleKey: access.user.roleKey,
    permissions: access.permissions,
  };
  const [{ t }, item, desk, bank] = await Promise.all([
    getI18n(),
    getQuiz(actor, id).catch((error) => {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }),
    listQuizzesDesk(actor),
    listQuestionBank(actor),
  ]);
  if (!item) notFound();

  return (
    <Container className="py-10">
      <PageHero
        eyebrow={t("quiz.eyebrow")}
        title={item.title}
        description={t("quiz.help")}
      />
      <p className="mb-6 text-sm font-semibold">
        <Link href="/staff/academic" className="text-brand underline">
          {t("quiz.back")}
        </Link>
      </p>
      <QuizDetail initial={item} subjects={desk.subjects} bank={bank} />
    </Container>
  );
}
