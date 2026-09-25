import Link from "next/link";
import { notFound } from "next/navigation";
import { QuizDetail } from "@/components/lms/quiz-detail";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { ApiError } from "@/server/api/errors";
import { getI18n } from "@/server/i18n/locale";
import { getQuiz } from "@/server/lms/quizzes";
import { requireParent } from "@/server/rbac/guard";

export const metadata = {
  title: "Quizzes",
};

export default async function FamilyQuizDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireParent();
  const { id } = await params;
  const [{ t }, item] = await Promise.all([
    getI18n(),
    getQuiz(
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
        eyebrow={t("quiz.eyebrow")}
        title={item.title}
        description={t("quiz.family_help")}
      />
      <Container className="py-10">
        <p className="mb-6 text-sm font-semibold">
          <Link href="/family/quizzes" className="text-brand underline">
            {t("quiz.back")}
          </Link>
        </p>
        <QuizDetail initial={item} subjects={[]} />
      </Container>
    </PublicShell>
  );
}
