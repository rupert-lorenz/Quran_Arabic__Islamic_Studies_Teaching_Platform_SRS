import { PublicShell } from "@/components/layout/public-shell";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { fieldClass } from "@/lib/api";
import { searchHelp } from "@/server/crm/help";
import { getI18n } from "@/server/i18n/locale";

export async function generateMetadata() {
  const { t } = await getI18n();
  return { title: t("cr.help.title"), description: t("cr.help.help") };
}

export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { t, locale } = await getI18n();
  const query = (await searchParams).q?.trim() ?? "";
  const articles = await searchHelp(query, locale.code);

  return (
    <PublicShell>
      <PageHero eyebrow={t("cr.help.title")} title={t("cr.help.title")} description={t("cr.help.help")}>
        <Breadcrumbs
          items={[
            { href: "/", label: t("crumb.home") },
            { label: t("cr.help.title") },
          ]}
        />
      </PageHero>
      <Container className="py-12">
        <form method="get" className="flex flex-wrap gap-3">
          <input
            name="q"
            defaultValue={query}
            minLength={2}
            className={`${fieldClass} max-w-md`}
            placeholder={t("cr.help.search")}
          />
          <Button type="submit">{t("cr.help.search")}</Button>
        </form>
        {articles.length ? (
          <ul className="mt-8 space-y-3">
            {articles.map((article) => (
              <li key={article.id} className="rounded-[var(--radius-card)] border border-line bg-surface px-5 py-4">
                <a href={article.href} className="font-heading text-lg font-bold tracking-tight text-brand">
                  {article.title}
                </a>
                {article.excerpt ? <p className="mt-2 text-sm leading-6 text-muted">{article.excerpt}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-8 text-sm text-muted">{t("cr.help.empty")}</p>
        )}
      </Container>
    </PublicShell>
  );
}
