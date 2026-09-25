import Link from "next/link";
import { notFound } from "next/navigation";
import { GamesDetail } from "@/components/lms/games-detail";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { ApiError } from "@/server/api/errors";
import { getI18n } from "@/server/i18n/locale";
import { getGame, listGamesDesk } from "@/server/lms/games";
import { requireApprovedTeacher } from "@/server/rbac/guard";

export const metadata = {
  title: "Interactive games",
};

export default async function TeacherGameDetailPage({
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
  const [{ t }, item, desk] = await Promise.all([
    getI18n(),
    getGame(actor, id).catch((error) => {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }),
    listGamesDesk(actor),
  ]);
  if (!item) notFound();

  return (
    <TeacherWorkspaceShell>
      <PageHero
        eyebrow={t("games.eyebrow")}
        title={item.title}
        description={t("games.help")}
      />
      <Container className="py-10">
        <p className="mb-6 text-sm font-semibold">
          <Link href="/teach/games" className="text-brand underline">
            {t("games.back")}
          </Link>
        </p>
        <GamesDetail initial={item} subjects={desk.subjects} />
      </Container>
    </TeacherWorkspaceShell>
  );
}
