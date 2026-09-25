import { CmsBody } from "@/components/cms/cms-body";
import { CmsJsonLd } from "@/components/cms/cms-json-ld";
import { PublicShell } from "@/components/layout/public-shell";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { listPublishedCms } from "@/server/cms/public";
import { pageMetadata } from "@/server/cms/seo";
import { getI18n } from "@/server/i18n/locale";

export async function generateMetadata() {
  const { t } = await getI18n();
  return pageMetadata({
    title: t("faq.title"),
    description: t("faq.description"),
    path: "/faq",
  });
}

export default async function FaqPage() {
  const [{ t }, faqs] = await Promise.all([
    getI18n(),
    listPublishedCms("faq"),
  ]);

  return (
    <PublicShell>
      <CmsJsonLd type="FAQPage" url="/faq" documents={faqs} />
      <PageHero
        eyebrow={t("faq.eyebrow")}
        title={t("faq.title")}
        description={t("faq.description")}
      >
        <Breadcrumbs
          items={[
            { href: "/", label: t("crumb.home") },
            { label: t("faq.title") },
          ]}
        />
      </PageHero>
      <Container className="max-w-3xl py-12">
        {faqs.length === 0 ? (
          <p className="rounded-[2rem] bg-gold px-5 py-4 font-semibold text-brand">
            {t("faq.empty")}
          </p>
        ) : (
          <div className="space-y-10">
            <nav
              aria-label={t("faq.jump")}
              className="rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
            >
              <p className="text-sm font-extrabold uppercase tracking-wide text-brand-soft">
                {t("faq.jump")}
              </p>
              <ul className="mt-3 space-y-2">
                {faqs.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`#${item.slug}`}
                      className="font-bold text-brand underline"
                    >
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="space-y-8">
              {faqs.map((item) => (
                <article key={item.id} id={item.slug} className="scroll-mt-28">
                  <h2 className="text-2xl font-extrabold text-brand">
                    {item.title}
                  </h2>
                  {item.excerpt ? (
                    <p className="mt-2 text-muted">{item.excerpt}</p>
                  ) : null}
                  <CmsBody
                    body={item.body}
                    className="mt-3 space-y-3 text-muted"
                  />
                </article>
              ))}
            </div>
          </div>
        )}
      </Container>
    </PublicShell>
  );
}
