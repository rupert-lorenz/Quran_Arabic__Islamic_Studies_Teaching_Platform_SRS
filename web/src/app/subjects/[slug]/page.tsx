import { notFound } from "next/navigation";
import { CatalogTeachers } from "@/components/catalog/catalog-teachers";
import { PublicShell } from "@/components/layout/public-shell";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { SeoJsonLd } from "@/components/seo/seo-json-ld";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { itemListJsonLd, webPageJsonLd } from "@/lib/seo-schema";
import { pageMetadata } from "@/server/cms/seo";
import { getI18n, getTranslatedSubject } from "@/server/i18n/locale";
import { listPublicTeachers } from "@/server/teacher/public";

const tones: Record<string, string> = {
  mint: "bg-mint",
  gold: "bg-gold",
  peach: "bg-peach",
  sky: "bg-sky",
  rose: "bg-rose",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [{ t }, subject] = await Promise.all([
    getI18n(),
    getTranslatedSubject(slug),
  ]);
  if (!subject) {
    return { title: t("subjects.title") };
  }
  return pageMetadata({
    title: subject.name,
    description: subject.summary || t("subjects.description"),
    path: `/subjects/${subject.slug}`,
  });
}

export default async function SubjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [{ t }, subject] = await Promise.all([
    getI18n(),
    getTranslatedSubject(slug),
  ]);
  if (!subject) {
    notFound();
  }
  const teachers = await listPublicTeachers({ subject: subject.slug });

  return (
    <PublicShell>
      <SeoJsonLd
        data={webPageJsonLd({
          name: subject.name,
          description: subject.summary,
          path: `/subjects/${subject.slug}`,
        })}
      />
      {teachers.length > 0 ? (
        <SeoJsonLd
          data={itemListJsonLd(
            `/subjects/${subject.slug}`,
            teachers.map((teacher) => ({
              name: teacher.displayName,
              href: `/teachers/${teacher.userId}`,
            })),
          )}
        />
      ) : null}
      <PageHero
        eyebrow={t("subjects.eyebrow")}
        title={subject.name}
        description={subject.summary}
      >
        <Breadcrumbs
          items={[
            { href: "/", label: t("crumb.home") },
            { href: "/subjects", label: t("nav.subjects") },
            { label: subject.name },
          ]}
        />
      </PageHero>
      <Container className="py-12">
        <div
          className={`rounded-[2rem] p-6 sm:p-8 ${tones[subject.tone] ?? "bg-mint"}`}
        >
          <p className="text-lg leading-8 text-muted">{t("subjects.about")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href={`/teachers?subject=${subject.slug}`}>
              {t("subjects.find_teacher")}
            </ButtonLink>
            <ButtonLink href={`/courses/${subject.slug}`} variant="secondary">
              {t("subjects.see_course")}
            </ButtonLink>
            {subject.slug === "quran" ||
            subject.slug === "hifdh" ||
            subject.slug === "tajweed" ||
            subject.slug === "arabic" ||
            subject.slug === "islamic-studies" ? (
              <>
                <ButtonLink href="/library" variant="secondary">
                  {t("library.open_shelf")}
                </ButtonLink>
                <ButtonLink href="/learn/progress" variant="secondary">
                  {t("progress.title")}
                </ButtonLink>
                {subject.slug === "quran" ||
                subject.slug === "hifdh" ||
                subject.slug === "tajweed" ? (
                  <ButtonLink href="/learn/quran" variant="secondary">
                    {t("quran.title")}
                  </ButtonLink>
                ) : null}
                {subject.slug === "arabic" ? (
                  <ButtonLink href="/learn/arabic" variant="secondary">
                    {t("arabic.title")}
                  </ButtonLink>
                ) : null}
                {subject.slug === "islamic-studies" ? (
                  <ButtonLink href="/learn/islamic-studies" variant="secondary">
                    {t("islamic.title")}
                  </ButtonLink>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
        <h2 className="mt-10 text-2xl font-extrabold text-brand">
          {t("subjects.teachers", { name: subject.name })}
        </h2>
        <div className="mt-5">
          <CatalogTeachers teachers={teachers} empty={t("subjects.empty_teachers")} />
        </div>
      </Container>
    </PublicShell>
  );
}
