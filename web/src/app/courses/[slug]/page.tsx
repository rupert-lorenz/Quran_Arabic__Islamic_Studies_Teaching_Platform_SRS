import { notFound } from "next/navigation";
import { CatalogTeachers } from "@/components/catalog/catalog-teachers";
import { PublicShell } from "@/components/layout/public-shell";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { SeoJsonLd } from "@/components/seo/seo-json-ld";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { courseJsonLd } from "@/lib/seo-schema";
import { pageMetadata } from "@/server/cms/seo";
import { getConfig } from "@/server/config";
import { getI18n, getTranslatedSubject } from "@/server/i18n/locale";
import { listPublicTeachers } from "@/server/teacher/public";

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
    return { title: t("courses.title") };
  }
  return pageMetadata({
    title: t("courses.item_title", { name: subject.name }),
    description: t("courses.item_description", { name: subject.name }),
    path: `/courses/${subject.slug}`,
  });
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [{ brand, t }, subject] = await Promise.all([
    getI18n(),
    getTranslatedSubject(slug),
  ]);
  if (!subject) {
    notFound();
  }
  const teachers = await listPublicTeachers({ subject: subject.slug });
  const title = t("courses.item_title", { name: subject.name });

  return (
    <PublicShell>
      <SeoJsonLd
        data={courseJsonLd({
          name: title,
          description: t("courses.item_description", { name: subject.name }),
          path: `/courses/${subject.slug}`,
          providerName: brand.name,
          providerUrl: getConfig().APP_URL,
          teachers: teachers.map((teacher) => ({
            name: teacher.displayName,
            href: `/teachers/${teacher.userId}`,
          })),
        })}
      />
      <PageHero
        eyebrow={t("courses.eyebrow")}
        title={title}
        description={t("courses.item_description", { name: subject.name })}
      >
        <Breadcrumbs
          items={[
            { href: "/", label: t("crumb.home") },
            { href: "/courses", label: t("nav.courses") },
            { label: title },
          ]}
        />
      </PageHero>
      <Container className="py-12">
        <p className="max-w-3xl text-lg leading-8 text-muted">{t("courses.about")}</p>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-muted">
          {subject.summary}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href={`/teachers?subject=${subject.slug}`}>
            {t("courses.find", { name: subject.name })}
          </ButtonLink>
          <ButtonLink href={`/subjects/${subject.slug}`} variant="secondary">
            {t("courses.see_subject")}
          </ButtonLink>
        </div>
        <h2 className="mt-10 text-2xl font-extrabold text-brand">
          {t("courses.teachers", { name: subject.name })}
        </h2>
        <div className="mt-5">
          <CatalogTeachers teachers={teachers} empty={t("courses.empty_teachers")} />
        </div>
      </Container>
    </PublicShell>
  );
}
