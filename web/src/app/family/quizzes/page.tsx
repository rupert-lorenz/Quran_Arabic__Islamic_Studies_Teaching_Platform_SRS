import Link from "next/link";
import { QuizList } from "@/components/lms/quiz-list";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { listQuizzes } from "@/server/lms/quizzes";
import { requireParent } from "@/server/rbac/guard";

export const metadata = {
  title: "Quizzes",
};

export default async function FamilyQuizzesPage() {
  const access = await requireParent();
  const [{ t }, items] = await Promise.all([
    getI18n(),
    listQuizzes({
      userId: access.user.id,
      roleKey: access.user.roleKey,
      permissions: access.permissions,
    }),
  ]);

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("quiz.eyebrow")}
        title={t("quiz.title")}
        description={t("quiz.family_help")}
      />
      <Container className="py-10">
        <p className="mb-6 text-sm font-semibold">
          <Link href="/family" className="text-brand underline">
            {t("library.back_family")}
          </Link>
        </p>
        <QuizList items={items} />
      </Container>
    </PublicShell>
  );
}
