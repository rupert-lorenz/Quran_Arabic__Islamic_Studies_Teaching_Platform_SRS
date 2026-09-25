import Link from "next/link";
import { GamesList } from "@/components/lms/games-list";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { listGames } from "@/server/lms/games";
import { requireParent } from "@/server/rbac/guard";

export const metadata = {
  title: "Interactive games",
};

export default async function FamilyGamesPage() {
  const access = await requireParent();
  const [{ t }, items] = await Promise.all([
    getI18n(),
    listGames({
      userId: access.user.id,
      roleKey: access.user.roleKey,
      permissions: access.permissions,
    }),
  ]);

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("games.eyebrow")}
        title={t("games.title")}
        description={t("games.family_help")}
      />
      <Container className="py-10">
        <p className="mb-6 text-sm font-semibold">
          <Link href="/family" className="text-brand underline">
            {t("library.back_family")}
          </Link>
        </p>
        <GamesList items={items} />
      </Container>
    </PublicShell>
  );
}
