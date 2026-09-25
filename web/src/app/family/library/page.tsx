import { TeachingMaterialLibrary } from "@/components/lms/teaching-material-library";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { getI18n } from "@/server/i18n/locale";
import { listTeachingLibrary } from "@/server/lms/library";
import { requireParent } from "@/server/rbac/guard";
import Link from "next/link";

export const metadata = {
  title: "Teaching library",
};

export default async function FamilyLibraryPage() {
  const access = await requireParent();
  const [{ t }, library] = await Promise.all([
    getI18n(),
    listTeachingLibrary({
      userId: access.user.id,
      roleKey: access.user.roleKey,
      permissions: access.permissions,
    }),
  ]);

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("library.eyebrow")}
        title={t("library.title")}
        description={t("library.family_help")}
      />
      <Container className="py-10">
        <p className="mb-6 text-sm font-semibold">
          <Link href="/family" className="text-brand underline">
            {t("library.back_family")}
          </Link>
        </p>
        <TeachingMaterialLibrary
          materials={library.materials}
          subjects={library.subjects}
          catalog={library.catalog}
          licences={library.licences}
          rentals={library.rentals}
          subscriptions={library.subscriptions}
          purchases={library.purchases}
          courses={library.courses}
          canUpload={library.canUpload}
          canManage={library.canManage}
        />
      </Container>
    </PublicShell>
  );
}
