import Link from "next/link";
import { HomeworkLearnerList } from "@/components/lms/homework-learner-list";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { listHomework } from "@/server/lms/homework";
import { requireStudent } from "@/server/rbac/guard";

export const metadata = {
  title: "Homework",
};

export default async function StudentHomeworkPage() {
  const access = await requireStudent();
  const [{ t }, items] = await Promise.all([
    getI18n(),
    listHomework({
      userId: access.user.id,
      roleKey: access.user.roleKey,
      permissions: access.permissions,
    }),
  ]);

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("homework.eyebrow")}
        title={t("homework.title")}
        description={t("homework.student_help")}
      />
      <Container className="py-10">
        <p className="mb-6 text-sm font-semibold">
          <Link href="/learn" className="text-brand underline">
            {t("library.back_learn")}
          </Link>
        </p>
        <HomeworkLearnerList items={items} />
      </Container>
    </PublicShell>
  );
}
