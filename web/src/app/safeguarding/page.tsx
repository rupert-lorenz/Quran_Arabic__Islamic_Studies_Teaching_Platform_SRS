import Link from "next/link";
import { CmsBody } from "@/components/cms/cms-body";
import { PublicShell } from "@/components/layout/public-shell";
import { ReportConcern } from "@/components/safeguarding/report-concern";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { SeoJsonLd } from "@/components/seo/seo-json-ld";
import { isStaffRole } from "@/lib/rbac";
import { webPageJsonLd } from "@/lib/seo-schema";
import { getPublishedCmsBySlug } from "@/server/cms/public";
import { cmsMetadata, pageMetadata } from "@/server/cms/seo";
import { getI18n } from "@/server/i18n/locale";
import { getAccessContext } from "@/server/rbac/guard";
import { listMySafeguardingReports } from "@/server/safeguarding/reports";

export async function generateMetadata() {
  const page = await getPublishedCmsBySlug(["policy", "page"], "safeguarding");
  if (page) {
    return cmsMetadata(page, "/safeguarding");
  }
  const { t } = await getI18n();
  return pageMetadata({
    title: t("safe.title"),
    description: t("safe.description"),
    path: "/safeguarding",
  });
}

export default async function SafeguardingPage() {
  const [{ t }, page, access] = await Promise.all([
    getI18n(),
    getPublishedCmsBySlug(["policy", "page"], "safeguarding"),
    getAccessContext(),
  ]);
  const canReport =
    access &&
    !access.twoFactorPending &&
    (isStaffRole(access.roleKey) ||
      access.roleKey === "teacher" ||
      access.roleKey === "parent" ||
      access.roleKey === "student")
      ? access
      : null;
  const reports = canReport
    ? (
        await listMySafeguardingReports({
          userId: canReport.user.id,
          roleKey: canReport.roleKey,
          permissions: canReport.permissions,
        })
      ).reports
    : null;

  return (
    <PublicShell>
      <SeoJsonLd
        data={webPageJsonLd({
          name: page?.title ?? t("safe.title"),
          description: page?.excerpt ?? t("safe.description"),
          path: "/safeguarding",
        })}
      />
      <PageHero
        eyebrow={t("safe.eyebrow")}
        title={page?.title ?? t("safe.title")}
        description={page?.excerpt ?? t("safe.description")}
      >
        <Breadcrumbs
          items={[
            { href: "/", label: t("crumb.home") },
            { label: page?.title ?? t("safe.title") },
          ]}
        />
      </PageHero>
      <Container className="py-12">
        {page ? (
          <CmsBody body={page.body} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {[
              t("safe.item1"),
              t("safe.item2"),
              t("safe.item3"),
              t("safe.item4"),
              t("safe.item5"),
              t("safe.item6"),
            ].map((item) => (
              <p
                key={item}
                className="rounded-[var(--radius-card)] border border-line bg-surface px-5 py-5 font-bold text-brand"
              >
                {item}
              </p>
            ))}
          </div>
        )}
        <div className="mt-10">
          {reports ? (
            <ReportConcern initial={reports} />
          ) : (
            <p className="rounded-[var(--radius-card)] border border-line bg-surface px-5 py-5 text-sm font-bold text-brand">
              <Link href="/login" className="underline">
                {t("safe.report.login")}
              </Link>
            </p>
          )}
        </div>
      </Container>
    </PublicShell>
  );
}
