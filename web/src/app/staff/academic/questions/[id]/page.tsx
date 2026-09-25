import Link from "next/link";
import { notFound } from "next/navigation";
import { QuestionBankDetail } from "@/components/lms/question-bank-detail";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { ApiError } from "@/server/api/errors";
import { getI18n } from "@/server/i18n/locale";
import {
  getQuestionBankItem,
  listQuestionBankDesk,
} from "@/server/lms/question-bank";
import { requireStaffPage } from "@/server/rbac/guard";

export const metadata = {
  title: "Question bank",
};

export default async function StaffQuestionBankDetailPage({
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
  const [{ t }, item, desk] = await Promise.all([
    getI18n(),
    getQuestionBankItem(actor, id).catch((error) => {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }),
    listQuestionBankDesk(actor),
  ]);
  if (!item) notFound();

  return (
    <Container className="py-10">
      <PageHero
        eyebrow={t("bank.eyebrow")}
        title={item.prompt}
        description={t("bank.help")}
      />
      <p className="mb-6 text-sm font-semibold">
        <Link href="/staff/academic" className="text-brand underline">
          {t("bank.back")}
        </Link>
      </p>
      <QuestionBankDetail initial={item} subjects={desk.subjects} />
    </Container>
  );
}
