import Link from "next/link";
import { notFound } from "next/navigation";
import { HomeworkDetail } from "@/components/lms/homework-detail";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { ApiError } from "@/server/api/errors";
import { getI18n } from "@/server/i18n/locale";
import { getHomework } from "@/server/lms/homework";
import { requireStaffPage } from "@/server/rbac/guard";

export const metadata = {
  title: "Homework",
};

export default async function StaffHomeworkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireStaffPage(["academic.curriculum"]);
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
    <Container className="py-10">
      <PageHero
        eyebrow={t("homework.eyebrow")}
        title={item.title}
        description={t("homework.help")}
      />
      <p className="mb-6 text-sm font-semibold">
        <Link href="/staff/academic" className="text-brand underline">
          {t("homework.back")}
        </Link>
      </p>
      <HomeworkDetail initial={item} students={[]} />
    </Container>
  );
}
