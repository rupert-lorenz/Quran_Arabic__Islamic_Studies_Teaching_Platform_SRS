import { notFound } from "next/navigation";
import { TeacherBookForm } from "@/components/bookings/teacher-book-form";
import { IntroVideoPlayer } from "@/components/teachers/intro-video-player";
import { TeacherPortrait } from "@/components/teachers/teacher-portrait";
import { TeacherReviewForm } from "@/components/teachers/teacher-review-form";
import { TeacherReviewsList } from "@/components/teachers/teacher-reviews-list";
import { TeacherRateBreakdown } from "@/components/teachers/teacher-rate-breakdown";
import { TeacherStatsPanel } from "@/components/teachers/teacher-stats-panel";
import { PublicShell } from "@/components/layout/public-shell";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { SeoJsonLd } from "@/components/seo/seo-json-ld";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { teacherPersonJsonLd, webPageJsonLd } from "@/lib/seo-schema";
import { isApiError } from "@/server/api/errors";
import { getServerUser } from "@/server/auth/session";
import {
  getOwnTeacherReview,
  listPublishedTeacherReviews,
} from "@/server/reviews/service";
import {
  formatAudienceList,
  parseAudienceList,
  teacherGenderLabel,
} from "@/lib/teacher-search";
import { publicVerifiedBadgeLabel } from "@/lib/teacher-status";
import { pageMetadata } from "@/server/cms/seo";
import { getI18n } from "@/server/i18n/locale";
import { getPublicTeacher } from "@/server/teacher/public";
import { bookingViewerForTeacherPage } from "@/server/booking/service";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const teacher = await getPublicTeacher(id);
    return pageMetadata({
      title: teacher.displayName,
      description: teacher.headline || teacher.bio || undefined,
      path: `/teachers/${id}`,
      ogType: "profile",
    });
  } catch {
    return { title: "Teacher" };
  }
}

export default async function PublicTeacherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let teacher;
  try {
    teacher = await getPublicTeacher(id);
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const viewer = await getServerUser();
  const [reviews, { t }, bookViewer] = await Promise.all([
    listPublishedTeacherReviews(id),
    getI18n(),
    bookingViewerForTeacherPage(
      viewer ? { id: viewer.id, roleKey: viewer.roleKey } : null,
    ),
  ]);
  const ownReview =
    viewer?.roleKey === "parent"
      ? await getOwnTeacherReview(viewer.id, id)
      : null;

  const path = `/teachers/${teacher.userId}`;

  return (
    <PublicShell>
      <SeoJsonLd
        data={teacherPersonJsonLd({
          name: teacher.displayName,
          path,
          description: teacher.headline || teacher.bio,
          countryName: teacher.countryName,
          languages: teacher.languages,
          subjects: teacher.subjects,
          rating: teacher.stats.averageRating,
          reviewCount: teacher.stats.reviewCount,
        })}
      />
      <SeoJsonLd
        data={webPageJsonLd({
          name: teacher.displayName,
          description: teacher.headline || teacher.bio,
          path,
          type: "ProfilePage",
        })}
      />
      <PageHero
        eyebrow={t("teachers.profile_eyebrow")}
        title={teacher.displayName}
        description={
          teacher.headline ||
          t("teachers.profile_fallback")
        }
      >
        <Breadcrumbs
          items={[
            { href: "/", label: t("crumb.home") },
            { href: "/teachers", label: t("nav.find_teachers") },
            { label: teacher.displayName },
          ]}
        />
      </PageHero>
      <Container className="grid gap-8 py-10 lg:grid-cols-[minmax(0,1.2fr)_20rem]">
        <div>
          <div className="mb-6 flex items-center gap-4">
            <TeacherPortrait
              name={teacher.displayName}
              src={teacher.photoUrl}
              size="lg"
            />
            <div>
              {teacher.verified ? (
                <p className="text-xs font-bold uppercase text-brand-soft">
                  {publicVerifiedBadgeLabel}
                </p>
              ) : null}
              <p className="text-sm font-semibold text-muted">
                {teacher.headline || t("teachers.profile_fallback")}
              </p>
            </div>
          </div>
          {teacher.video ? (
            <IntroVideoPlayer
              playback={teacher.video.playback}
              url={teacher.video.watchUrl}
              title={`${teacher.displayName} introduction`}
            />
          ) : (
            <p className="rounded-[2rem] bg-gold px-5 py-4 font-semibold text-brand">
              This teacher does not have a verified introduction video yet.
            </p>
          )}
          {teacher.bio ? (
            <p className="mt-6 text-base leading-7 text-muted">{teacher.bio}</p>
          ) : null}
          <section className="mt-8">
            <h2 className="text-2xl font-extrabold text-brand">Reviews</h2>
            <div className="mt-4">
              <TeacherReviewsList reviews={reviews} />
            </div>
            <div className="mt-6">
              {viewer?.roleKey === "parent" ? (
                <TeacherReviewForm
                  teacherUserId={teacher.userId}
                  initial={ownReview}
                />
              ) : (
                <p className="rounded-[2rem] bg-mint px-5 py-4 font-semibold text-brand">
                  {viewer
                    ? "Parent accounts can leave a rating after viewing a teacher."
                    : "Sign in as a parent to leave a rating and review."}{" "}
                  {!viewer ? (
                    <a href="/login" className="underline">
                      Sign in
                    </a>
                  ) : null}
                </p>
              )}
            </div>
          </section>
        </div>
        <aside className="h-fit rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          {teacher.verified ? (
            <p className="text-xs font-bold uppercase text-brand-soft">
              {publicVerifiedBadgeLabel}
            </p>
          ) : null}
          <p className="mt-2 text-sm font-bold text-brand-soft">
            {teacher.subjects.length > 0
              ? teacher.subjects.map((item, index) => (
                  <span key={item.slug}>
                    {index > 0 ? " · " : null}
                    <a href={`/subjects/${item.slug}`} className="underline">
                      {item.name}
                    </a>
                  </span>
                ))
              : "Subjects coming soon"}
          </p>
          <p className="mt-2 text-sm text-muted">
            {teacher.languages || "Languages to be confirmed"}
            {teacher.countryName ? ` · ${teacher.countryName}` : ""}
          </p>
          {teacherGenderLabel(teacher.gender) ||
          parseAudienceList(teacher.audiences).length ? (
            <p className="mt-2 text-sm font-semibold text-brand">
              {[
                teacherGenderLabel(teacher.gender),
                formatAudienceList(parseAudienceList(teacher.audiences)),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          <div className="mt-4">
            {teacher.rate ? (
              <TeacherRateBreakdown
                rate={teacher.rate}
                title={t("card.rate")}
                listedAs={
                  teacher.rate.listedFormatted
                    ? t("card.listed_as", { price: teacher.rate.listedFormatted })
                    : undefined
                }
              />
            ) : (
              <p className="text-2xl font-extrabold text-brand">
                Rate to be listed
              </p>
            )}
          </div>
          <div className="mt-5">
            <TeacherStatsPanel stats={teacher.stats} />
          </div>
          {teacher.recommendation.reasons.length ? (
            <div className="mt-5 rounded-[1.5rem] bg-mint/60 p-4">
              <p className="text-xs font-bold uppercase text-brand-soft">
                Marketplace recommendation
              </p>
              <p className="mt-2 text-sm font-semibold text-brand">
                {teacher.recommendation.reasons.join(" · ")}
              </p>
            </div>
          ) : null}
          <div className="mt-6">
            {teacher.offersGroupTeaching ? (
              <div className="mb-5 rounded-[1.5rem] bg-gold/60 p-4">
                <p className="font-extrabold text-brand">
                  {t("group.available_with_teacher")}
                </p>
                <ButtonLink
                  href={`/group-lessons?teacher=${teacher.userId}`}
                  variant="secondary"
                  className="mt-3 w-full"
                >
                  {t("group.view_teacher_classes")}
                </ButtonLink>
              </div>
            ) : null}
            <p className="mb-3 text-xs font-bold uppercase text-brand-soft">
              {t("booking.title")}
            </p>
            <TeacherBookForm
              teacherUserId={teacher.userId}
              teacherName={teacher.displayName}
              subjects={teacher.subjects}
              hasRate={Boolean(teacher.rate)}
              hourlyRate={teacher.rate?.formatted ?? teacher.rate?.studentPays}
              viewer={bookViewer}
            />
          </div>
        </aside>
      </Container>
    </PublicShell>
  );
}
