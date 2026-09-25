import { GamesDesk } from "@/components/lms/games-desk";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { listGamesDesk } from "@/server/lms/games";
import { requireApprovedTeacher } from "@/server/rbac/guard";

export const metadata = {
  title: "Interactive games",
};

export default async function TeacherGamesPage() {
  const access = await requireApprovedTeacher();
  const [{ t }, desk] = await Promise.all([
    getI18n(),
    listGamesDesk({
      userId: access.user.id,
      roleKey: access.user.roleKey,
      permissions: access.permissions,
    }),
  ]);

  return (
    <TeacherWorkspaceShell>
      <PageHero
        eyebrow={t("games.eyebrow")}
        title={t("games.title")}
        description={t("games.help")}
      />
      <Container className="py-10">
        <GamesDesk initial={desk} />
      </Container>
    </TeacherWorkspaceShell>
  );
}
