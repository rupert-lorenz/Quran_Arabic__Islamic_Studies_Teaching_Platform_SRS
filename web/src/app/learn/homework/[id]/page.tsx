import Link from "next/link";
import { notFound } from "next/navigation";
import { HomeworkDetail } from "@/components/lms/homework-detail";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { ApiError } from "@/server/api/errors";
import { getI18n } from "@/server/i18n/locale";
import { getHomework } from "@/server/lms/homework";
import { requireStudent } from "@/server/rbac/guard";

export const metadata = {
  title: "Homework",
};

export default async function StudentHomeworkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireStudent();
  const { id } = await params;
  const [{ t }, item] = await Promise.all([
    getI18n(),
    getHomework(
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
        eyebrow={t("homework.eyebrow")}
        title={item.title}
        description={t("homework.student_help")}
      />
      <Container className="py-10">
        <p className="mb-6 text-sm font-semibold">
          <Link href="/learn/homework" className="text-brand underline">
            {t("homework.back")}
          </Link>
        </p>
        <HomeworkDetail initial={item} students={[]} />
      </Container>
    </PublicShell>
  );
}
