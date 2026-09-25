import { PublicShell } from "@/components/layout/public-shell";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { SeoJsonLd } from "@/components/seo/seo-json-ld";
import { TeacherCard } from "@/components/teachers/teacher-card";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { webPageJsonLd } from "@/lib/seo-schema";
import { parseAudienceList } from "@/lib/teacher-search";
import { pageMetadata } from "@/server/cms/seo";
import { getI18n } from "@/server/i18n/locale";
import { listPublicTeachers } from "@/server/teacher/public";

export async function generateMetadata() {
  const { t } = await getI18n();
  return pageMetadata({
    title: t("parents.title"),
    description: t("parents.description"),
    path: "/parents",
  });
}

export default async function ParentsPage() {
  const [{ t }, teachers] = await Promise.all([
    getI18n(),
    listPublicTeachers().catch(() => []),
  ]);
  const points = [
    { title: t("parents.point1_title"), text: t("parents.point1_text") },
    { title: t("parents.point2_title"), text: t("parents.point2_text") },
    { title: t("parents.point3_title"), text: t("parents.point3_text") },
  ];

  return (
    <PublicShell>
      <SeoJsonLd
        data={webPageJsonLd({
          name: t("parents.title"),
          description: t("parents.description"),
          path: "/parents",
        })}
      />
      <PageHero
        eyebrow={t("parents.eyebrow")}
        title={t("parents.title")}
        description={t("parents.description")}
      >
        <Breadcrumbs
          items={[
            { href: "/", label: t("crumb.home") },
            { label: t("parents.title") },
          ]}
        />
      </PageHero>
      <Container className="grid gap-5 py-12 sm:grid-cols-2 xl:grid-cols-3">
        {points.map((point) => (
          <article
            key={point.title}
            className="rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-card)]"
          >
            <h2 className="text-xl font-extrabold text-brand">{point.title}</h2>
            <p className="mt-3 text-muted">{point.text}</p>
          </article>
        ))}
      </Container>
      {teachers.length > 0 ? (
        <Container className="pb-8">
          <h2 className="text-2xl font-extrabold text-brand">{t("home.teachers_title")}</h2>
          <p className="mt-2 max-w-2xl text-muted">{t("home.guest_note")}</p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {teachers.slice(0, 3).map((teacher) => (
              <TeacherCard
                key={teacher.userId}
                name={teacher.displayName}
                subjects={
                  teacher.subjects.map((item) => item.name).join(" · ") ||
                  t("home.featured_teacher")
                }
                languages={teacher.languages || ""}
                rating={teacher.stats.ratingLabel}
                lessons={String(teacher.lessonsTaught)}
                level={teacher.headline || t("home.featured_teacher")}
                price={teacher.rate?.formatted}
                rate={teacher.rate ?? undefined}
                href={`/teachers/${teacher.userId}`}
                hasVideo={Boolean(teacher.video)}
                verified={teacher.verified}
                gender={teacher.gender}
                audiences={parseAudienceList(teacher.audiences)}
                photoUrl={teacher.photoUrl}
                videoThumbnailUrl={teacher.video?.playback?.thumbnailUrl}
              />
            ))}
          </div>
        </Container>
      ) : null}
      <Container className="pb-16">
        <div className="rounded-[2rem] bg-peach px-6 py-10 text-center sm:px-10">
          <h2 className="text-3xl font-extrabold text-brand">
            {t("parents.cta_title")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            {t("parents.cta_text")}
          </p>
          <div className="mt-6 flex justify-center">
            <ButtonLink href="/register?role=parent" size="lg">
              {t("parents.cta_button")}
            </ButtonLink>
          </div>
        </div>
      </Container>
    </PublicShell>
  );
}
