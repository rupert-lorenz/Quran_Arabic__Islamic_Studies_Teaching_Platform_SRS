import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentBody } from "@/components/docs/document-body";
import { Container } from "@/components/ui/container";
import type { UiMessageKey } from "@/lib/i18n";
import { documentBlocks, isDocId } from "@/server/docs/content";
import { getI18n } from "@/server/i18n/locale";
import { requireStaffPage } from "@/server/rbac/guard";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { t } = await getI18n();
  if (!isDocId(slug)) return { title: t("dc.page.title") };
  const title = t(`dc.${slug}.title` as UiMessageKey);
  return { title, description: t(`dc.${slug}.help` as UiMessageKey) };
}

export default async function StaffDocumentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isDocId(slug)) notFound();
  const { t, locale } = await getI18n();
  await requireStaffPage();

  return (
    <Container className="space-y-8 py-10">
      <DocumentBody
        title={t(`dc.${slug}.title` as UiMessageKey)}
        help={t(`dc.${slug}.help` as UiMessageKey)}
        blocks={documentBlocks(slug, locale.code)}
      />
      <p className="text-sm">
        <Link href="/staff/docs" className="font-bold text-brand-accent underline">
          {t("dc.back.docs")}
        </Link>
      </p>
    </Container>
  );
}
