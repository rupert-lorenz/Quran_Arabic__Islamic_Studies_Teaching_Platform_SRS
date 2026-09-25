import { FeaturedTeacherShowcase } from "@/components/teachers/featured-teacher-showcase";
import { TeacherCard } from "@/components/teachers/teacher-card";
import { PublicShell } from "@/components/layout/public-shell";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { parseAudienceList } from "@/lib/teacher-search";
import { pageMetadata } from "@/server/cms/seo";
import { getI18n } from "@/server/i18n/locale";
import { listPublicTeachers } from "@/server/teacher/public";

export async function generateMetadata() {
  const { t } = await getI18n();
  return pageMetadata({
    title: t("preview.title"),
    description: t("preview.description"),
    path: "/preview",
    index: false,
  });
}

export default async function PreviewPage() {
  const [{ t }, teachers] = await Promise.all([
    getI18n(),
    listPublicTeachers().catch(() => []),
  ]);
  const featured = teachers.find((item) => item.video) ?? teachers[0] ?? null;

  return (
    <PublicShell>
      <PageHero
        eyebrow={t("preview.eyebrow")}
        title={t("preview.title")}
        description={t("preview.description")}
      >
        <Breadcrumbs
          items={[
            { href: "/", label: t("crumb.home") },
            { label: t("preview.eyebrow") },
          ]}
        />
      </PageHero>
      <Container className="py-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <ButtonLink href="/teachers">{t("preview.browse")}</ButtonLink>
          <ButtonLink href="/" variant="secondary">
            {t("preview.home")}
          </ButtonLink>
          <ButtonLink href="/parents" variant="secondary">
            {t("preview.parents")}
          </ButtonLink>
          <ButtonLink href="/register?role=parent" variant="secondary">
            {t("preview.register")}
          </ButtonLink>
        </div>
        {featured ? (
          <div className="mt-10 max-w-3xl">
            <FeaturedTeacherShowcase
              teacher={{
                userId: featured.userId,
                displayName: featured.displayName,
                headline: featured.headline,
                subjects:
                  featured.subjects.map((item) => item.name).join(" · ") ||
                  t("home.featured_teacher"),
                photoUrl: featured.photoUrl,
                video: featured.video,
              }}
              watchLabel={t("home.watch_intro")}
              profileLabel={t("home.open_profile")}
            />
          </div>
        ) : null}
        {teachers.length > 0 ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {teachers.slice(0, 6).map((teacher) => (
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
                responseRate={teacher.stats.responseRate}
                gender={teacher.gender}
                audiences={parseAudienceList(teacher.audiences)}
                featured={teacher.recommendation.featured}
                photoUrl={teacher.photoUrl}
                videoThumbnailUrl={teacher.video?.playback?.thumbnailUrl}
              />
            ))}
          </div>
        ) : (
          <p className="mt-10 rounded-[2rem] bg-gold px-5 py-4 font-semibold text-brand">
            {t("teachers.no_match")}
          </p>
        )}
      </Container>
    </PublicShell>
  );
}
