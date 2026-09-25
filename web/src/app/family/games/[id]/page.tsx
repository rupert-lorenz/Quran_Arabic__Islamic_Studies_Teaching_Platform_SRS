import Link from "next/link";
import { notFound } from "next/navigation";
import { GamesDetail } from "@/components/lms/games-detail";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { ApiError } from "@/server/api/errors";
import { getI18n } from "@/server/i18n/locale";
import { getGame } from "@/server/lms/games";
import { requireParent } from "@/server/rbac/guard";

export const metadata = {
  title: "Interactive games",
};

export default async function FamilyGameDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await requireParent();
  const { id } = await params;
  const [{ t }, item] = await Promise.all([
    getI18n(),
    getGame(
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
        eyebrow={t("games.eyebrow")}
        title={item.title}
        description={t("games.family_help")}
      />
      <Container className="py-10">
        <p className="mb-6 text-sm font-semibold">
          <Link href="/family/games" className="text-brand underline">
            {t("games.back")}
          </Link>
        </p>
        <GamesDetail initial={item} subjects={[]} />
      </Container>
    </PublicShell>
  );
}
