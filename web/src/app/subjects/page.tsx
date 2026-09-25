import Link from "next/link";
import { PublicShell } from "@/components/layout/public-shell";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { SeoJsonLd } from "@/components/seo/seo-json-ld";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { itemListJsonLd, webPageJsonLd } from "@/lib/seo-schema";
import { pageMetadata } from "@/server/cms/seo";
import { getI18n, listTranslatedSubjects } from "@/server/i18n/locale";

export async function generateMetadata() {
  const { t } = await getI18n();
  return pageMetadata({
    title: t("subjects.title"),
    description: t("subjects.description"),
    path: "/subjects",
  });
}

const tones: Record<string, string> = {
  mint: "bg-mint",
  gold: "bg-gold",
  peach: "bg-peach",
  sky: "bg-sky",
  rose: "bg-rose",
};

export default async function SubjectsPage() {
  const [i18n, catalog] = await Promise.all([
    getI18n(),
    listTranslatedSubjects(),
  ]);

  return (
    <PublicShell>
      <SeoJsonLd
        data={webPageJsonLd({
          name: i18n.t("subjects.title"),
          description: i18n.t("subjects.description"),
          path: "/subjects",
          type: "CollectionPage",
        })}
      />
      <SeoJsonLd
        data={itemListJsonLd(
          "/subjects",
          catalog.map((item) => ({
            name: item.name,
            href: `/subjects/${item.slug}`,
          })),
        )}
      />
      <PageHero
        eyebrow={i18n.t("subjects.eyebrow")}
        title={i18n.t("subjects.title")}
        description={i18n.t("subjects.description")}
      >
        <Breadcrumbs
          items={[
            { href: "/", label: i18n.t("crumb.home") },
            { label: i18n.t("nav.subjects") },
          ]}
        />
      </PageHero>
      <Container className="grid gap-5 py-12">
        {catalog.map((subject) => (
          <section
            key={subject.slug}
            id={subject.slug}
            className={`scroll-mt-28 rounded-[2rem] p-6 sm:p-8 ${tones[subject.tone]}`}
          >
            <h2 className="text-3xl font-extrabold text-brand">
              <Link href={`/subjects/${subject.slug}`} className="hover:underline">
                {subject.name}
              </Link>
            </h2>
            <p className="mt-3 max-w-2xl text-lg text-muted">
              {subject.summary}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink href={`/subjects/${subject.slug}`}>
                {i18n.t("subjects.open")}
              </ButtonLink>
              <ButtonLink href={`/teachers?subject=${subject.slug}`} variant="secondary">
                {i18n.t("subjects.find_teacher")}
              </ButtonLink>
            </div>
          </section>
        ))}
      </Container>
    </PublicShell>
  );
}
