import Link from "next/link";
import { ExamList } from "@/components/lms/exam-list";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { listExams } from "@/server/lms/exams";
import { requireParent } from "@/server/rbac/guard";

export const metadata = {
  title: "Exams",
};

export default async function FamilyExamsPage() {
  const access = await requireParent();
  const [{ t }, items] = await Promise.all([
    getI18n(),
    listExams({
      userId: access.user.id,
      roleKey: access.user.roleKey,
      permissions: access.permissions,
    }),
  ]);

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("exam.eyebrow")}
        title={t("exam.title")}
        description={t("exam.family_help")}
      />
      <Container className="py-10">
        <p className="mb-6 text-sm font-semibold">
          <Link href="/family" className="text-brand underline">
            {t("library.back_family")}
          </Link>
        </p>
        <ExamList items={items} />
      </Container>
    </PublicShell>
  );
}
