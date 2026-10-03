import Link from "next/link";
import { DocumentBody } from "@/components/docs/document-body";
import { PublicShell } from "@/components/layout/public-shell";
import { Container } from "@/components/ui/container";
import { documentBlocks } from "@/server/docs/content";
import { getI18n } from "@/server/i18n/locale";
import { requireParent } from "@/server/rbac/guard";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("dc.parent.title"), description: t("dc.parent.help") };
}

export default async function ParentGuidePage() {
  const { t, locale } = await getI18n();
  await requireParent();

  return (
    <PublicShell>
      <Container className="space-y-8 py-10">
        <DocumentBody
          title={t("dc.parent.title")}
          help={t("dc.parent.help")}
          blocks={documentBlocks("parent", locale.code)}
        />
        <p className="text-sm">
          <Link href="/family" className="font-bold text-brand-accent underline">
            {t("dc.back.parent")}
          </Link>
        </p>
      </Container>
    </PublicShell>
  );
}
