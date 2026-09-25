import Link from "next/link";
import { PublicShell } from "@/components/layout/public-shell";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { SeoJsonLd } from "@/components/seo/seo-json-ld";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { itemListJsonLd, webPageJsonLd } from "@/lib/seo-schema";
import { pageMetadata } from "@/server/cms/seo";
import { getI18n, listTranslatedSubjects } from "@/server/i18n/locale";

const tones: Record<string, string> = {
  mint: "bg-mint",
  gold: "bg-gold",
  peach: "bg-peach",
  sky: "bg-sky",
  rose: "bg-rose",
};

export async function generateMetadata() {
  const { t } = await getI18n();
  return pageMetadata({
    title: t("courses.title"),
    description: t("courses.description"),
    path: "/courses",
  });
}

export default async function CoursesPage() {
  const [{ t }, catalog] = await Promise.all([
    getI18n(),
    listTranslatedSubjects(),
  ]);

  return (
    <PublicShell>
      <SeoJsonLd
        data={webPageJsonLd({
          name: t("courses.title"),
          description: t("courses.description"),
          path: "/courses",
          type: "CollectionPage",
        })}
      />
      <SeoJsonLd
        data={itemListJsonLd(
          "/courses",
          catalog.map((item) => ({
            name: t("courses.item_title", { name: item.name }),
            href: `/courses/${item.slug}`,
          })),
        )}
      />
      <PageHero
        eyebrow={t("courses.eyebrow")}
        title={t("courses.title")}
        description={t("courses.description")}
      >
        <Breadcrumbs
          items={[
            { href: "/", label: t("crumb.home") },
            { label: t("nav.courses") },
          ]}
        />
      </PageHero>
      <Container className="grid gap-5 py-12">
        {catalog.map((subject) => (
          <article
            key={subject.slug}
            className={`rounded-[2rem] p-6 sm:p-8 ${tones[subject.tone] ?? "bg-mint"}`}
          >
            <h2 className="text-3xl font-extrabold text-brand">
              {t("courses.item_title", { name: subject.name })}
            </h2>
            <p className="mt-3 max-w-2xl text-lg text-muted">{subject.summary}</p>
            <p className="mt-5">
              <Link
                href={`/courses/${subject.slug}`}
                className="font-bold text-brand underline"
              >
                {t("courses.open")}
              </Link>
            </p>
          </article>
        ))}
      </Container>
    </PublicShell>
  );
}
