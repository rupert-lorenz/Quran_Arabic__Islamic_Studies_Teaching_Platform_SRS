import { PublicShell } from "@/components/layout/public-shell";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { SeoJsonLd } from "@/components/seo/seo-json-ld";
import { TeacherCard } from "@/components/teachers/teacher-card";
import { TeacherSearchForm } from "@/components/teachers/teacher-search-form";
import { TeacherSortBar } from "@/components/teachers/teacher-sort-bar";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { itemListJsonLd, webPageJsonLd } from "@/lib/seo-schema";
import { sampleTeachers } from "@/lib/site";
import { omitInternalTeacherPayment } from "@/lib/teacher-rate-display";
import {
  normalizeTeacherSort,
  recommendTeacher,
  sortTeachers,
  type RankableTeacher,
} from "@/lib/teacher-ranking";
import { teacherReliability } from "@/lib/teacher-reputation";
import {
  hasTeacherSearchFilters,
  parseAudienceList,
  teacherMatchesSearch,
  type SearchableTeacher,
  type TeacherSearchQuery,
} from "@/lib/teacher-search";
import { pageMetadata } from "@/server/cms/seo";
import { getI18n } from "@/server/i18n/locale";
import { getRequestMoney } from "@/server/money/currency";
import {
  getPublicTeacherFilterOptions,
  listPublicTeachers,
} from "@/server/teacher/public";

export async function generateMetadata() {
  const { t } = await getI18n();
  return pageMetadata({
    title: t("teachers.title"),
    description: t("teachers.description"),
    path: "/teachers",
  });
}

export default async function TeachersPage({
  searchParams,
}: {
  searchParams: Promise<TeacherSearchQuery>;
}) {
  const filters = await searchParams;
  const [teachers, options, { t }, money] = await Promise.all([
    listPublicTeachers(filters),
    getPublicTeacherFilterOptions(),
    getI18n(),
    getRequestMoney(),
  ]);
  const samples = sampleTeachers.map((teacher) => ({
    ...teacher,
    rate: omitInternalTeacherPayment(
      money.presentRate(teacher.rate, {
        code: teacher.rate.currencyCode,
        symbol: "£",
        decimalPlaces: 2,
      }) ?? teacher.rate,
    ),
  }));
  const filtered = hasTeacherSearchFilters(filters);
  const sort = normalizeTeacherSort(filters.sort);
  const visibleSamples =
    teachers.length === 0
      ? sortTeachers(
          filtered
            ? samples.filter((teacher) =>
                teacherMatchesSearch(
                  searchableSample(teacher, options.subjects),
                  filters,
                ),
              )
            : samples,
          (teacher) => sampleToRankable(teacher, options.subjects),
          sort,
          filters,
        )
      : [];
  const showingSamples = teachers.length === 0 && visibleSamples.length > 0;
  const countLabel =
    teachers.length > 0
      ? t(teachers.length === 1 ? "teachers.match_one" : "teachers.match_many", {
          count: teachers.length,
        })
      : showingSamples
        ? filtered
          ? t(
              visibleSamples.length === 1
                ? "teachers.sample_match_one"
                : "teachers.sample_match_many",
              { count: visibleSamples.length },
            )
          : t("teachers.sample_empty")
        : t("teachers.no_match");

  return (
    <PublicShell>
      <SeoJsonLd
        data={webPageJsonLd({
          name: t("teachers.title"),
          description: t("teachers.description"),
          path: "/teachers",
          type: "CollectionPage",
        })}
      />
      {teachers.length > 0 ? (
        <SeoJsonLd
          data={itemListJsonLd(
            "/teachers",
            teachers.map((teacher) => ({
              name: teacher.displayName,
              href: `/teachers/${teacher.userId}`,
            })),
          )}
        />
      ) : null}
      <PageHero
        eyebrow={t("teachers.eyebrow")}
        title={t("teachers.title")}
        description={t("teachers.description")}
      >
        <Breadcrumbs
          items={[
            { href: "/", label: t("crumb.home") },
            { label: t("nav.find_teachers") },
          ]}
        />
      </PageHero>
      <Container className="py-10">
        <TeacherSearchForm filters={filters} options={options} />
        <TeacherSortBar filters={filters} countLabel={countLabel} />

        {teachers.length > 0 ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {teachers.map((teacher) => (
              <TeacherCard
                key={teacher.userId}
                name={teacher.displayName}
                subjects={
                  teacher.subjects.map((item) => item.name).join(" · ") ||
                  "Subjects to be listed"
                }
                languages={teacher.languages || "Languages to be listed"}
                rating={teacher.stats.ratingLabel}
                lessons={String(teacher.lessonsTaught)}
                level={teacher.headline || "Approved teacher"}
                price={teacher.rate?.formatted}
                rate={teacher.rate ?? undefined}
                href={`/teachers/${teacher.userId}`}
                hasVideo={Boolean(teacher.video)}
                verified={teacher.verified}
                reliability={teacher.stats.reliability.label}
                responseRate={teacher.stats.responseRate}
                gender={teacher.gender}
                audiences={parseAudienceList(teacher.audiences)}
                featured={teacher.recommendation.featured}
                recommendationReasons={
                  sort === "recommended"
                    ? teacher.recommendation.reasons
                    : undefined
                }
                photoUrl={teacher.photoUrl}
                videoThumbnailUrl={teacher.video?.playback?.thumbnailUrl}
              />
            ))}
          </div>
        ) : showingSamples ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {visibleSamples.map((teacher, index) => {
              const recommendation = recommendTeacher(
                sampleToRankable(teacher, options.subjects),
                filters,
              );
              return (
                <TeacherCard
                  key={teacher.name}
                  name={teacher.name}
                  subjects={teacher.subjects}
                  languages={teacher.languages}
                  rating={teacher.rating}
                  lessons={teacher.lessons}
                  level={teacher.level}
                  price={teacher.rate.formatted}
                  rate={teacher.rate}
                  hasVideo={teacher.hasVideo}
                  gender={teacher.gender}
                  audiences={[...teacher.audiences]}
                  reliability={teacherReliability({
                    averageRating: Number(teacher.rating),
                    reviewCount: teacher.reviewCount,
                    responseRate: teacher.responseRate,
                    lessonsTaught: teacher.lessonsTaught,
                    recommendPercent: teacher.recommendPercent,
                  }).label}
                  responseRate={teacher.responseRate}
                  featured={
                    sort === "recommended" &&
                    index === 0 &&
                    visibleSamples.length > 1
                  }
                  recommendationReasons={
                    sort === "recommended" ? recommendation.reasons : undefined
                  }
                  photoUrl={teacher.photoUrl}
                  videoThumbnailUrl={teacher.video.playback?.thumbnailUrl}
                  href="/teachers"
                />
              );
            })}
          </div>
        ) : (
          <p className="mt-6 rounded-[2rem] bg-gold px-5 py-4 font-semibold text-brand">
            {t("teachers.no_match")}
          </p>
        )}
      </Container>
    </PublicShell>
  );
}

type SampleTeacherCard = Omit<(typeof sampleTeachers)[number], "rate"> & {
  rate: { amount: string };
};

function searchableSample(
  teacher: SampleTeacherCard,
  catalog: { slug: string; name: string }[],
): SearchableTeacher {
  return {
    displayName: teacher.name,
    headline: teacher.level,
    bio: null,
    languages: teacher.languages,
    country: teacher.country,
    countryName: catalogCountryName(teacher.country),
    subjects: teacher.subjectSlugs.map((slug) => ({
      slug,
      name: catalog.find((item) => item.slug === slug)?.name ?? slug,
    })),
    gender: teacher.gender,
    audiences: [...teacher.audiences],
    rateAmount: Number(teacher.rate.amount),
    hasVideo: teacher.hasVideo,
    rating: Number(teacher.rating),
  };
}

function sampleToRankable(
  teacher: SampleTeacherCard,
  catalog: { slug: string; name: string }[],
): RankableTeacher {
  return {
    displayName: teacher.name,
    headline: teacher.level,
    languages: teacher.languages,
    subjects: teacher.subjectSlugs.map((slug) => ({
      slug,
      name: catalog.find((item) => item.slug === slug)?.name ?? slug,
    })),
    rating: Number(teacher.rating),
    reviewCount: teacher.reviewCount,
    lessonsTaught: teacher.lessonsTaught,
    responseRate: teacher.responseRate,
    recommendPercent: teacher.recommendPercent,
    hasVideo: teacher.hasVideo,
    rateAmount: Number(teacher.rate.amount),
  };
}

function catalogCountryName(iso2: string) {
  if (iso2 === "GB") {
    return "United Kingdom";
  }
  if (iso2 === "PK") {
    return "Pakistan";
  }
  return iso2;
}
