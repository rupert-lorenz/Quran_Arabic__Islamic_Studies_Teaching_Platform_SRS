import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { PublicShell } from "@/components/layout/public-shell";
import { SectionHeading } from "@/components/ui/section-heading";
import { FeaturedTeacherShowcase } from "@/components/teachers/featured-teacher-showcase";
import { TeacherCard } from "@/components/teachers/teacher-card";
import { sampleTeachers } from "@/lib/site";
import { omitInternalTeacherPayment } from "@/lib/teacher-rate-display";
import { recommendTeacher } from "@/lib/teacher-ranking";
import { parseAudienceList } from "@/lib/teacher-search";
import { SeoJsonLd } from "@/components/seo/seo-json-ld";
import { webSiteJsonLd } from "@/lib/seo-schema";
import { listPublishedCms } from "@/server/cms/public";
import { pageMetadata } from "@/server/cms/seo";
import { getConfig } from "@/server/config";
import { ClassroomPreview } from "@/components/classroom/classroom-preview";
import { getClassroomOverlay } from "@/server/classroom/brand";
import { getI18n, listTranslatedSubjects } from "@/server/i18n/locale";
import { getRequestMoney } from "@/server/money/currency";
import { getSiteSeo } from "@/server/seo/site";
import { listPublicTeachers } from "@/server/teacher/public";

export async function generateMetadata() {
  const [{ brand }, seo] = await Promise.all([getI18n(), getSiteSeo()]);
  return pageMetadata({
    title: seo.defaultTitle || brand.tagline || brand.name,
    description: seo.defaultDescription || brand.description,
    path: "/",
  });
}

const tones: Record<string, string> = {
  mint: "bg-mint",
  gold: "bg-gold",
  peach: "bg-peach",
  sky: "bg-sky",
  rose: "bg-rose",
};

export default async function Home() {
  const [i18n, subjects, money, announcements, liveTeachers, overlay] =
    await Promise.all([
      getI18n(),
      listTranslatedSubjects(),
      getRequestMoney(),
      listPublishedCms("announcement", 2).catch(() => []),
      listPublicTeachers().catch(() => []),
      getClassroomOverlay(),
    ]);
  const sampleCards = sampleTeachers.map((teacher) => ({
    ...teacher,
    rate: omitInternalTeacherPayment(
      money.presentRate(teacher.rate, {
        code: teacher.rate.currencyCode,
        symbol: "£",
        decimalPlaces: 2,
      }) ?? teacher.rate,
    ),
  }));
  const liveCards = liveTeachers.slice(0, 6);
  const usingLiveTeachers = liveCards.length > 0;
  const showcase =
    liveCards.find((teacher) => teacher.video) ?? liveCards[0] ?? null;
  const sampleShowcase = sampleCards[0];
  const { brand, t } = i18n;
  const steps = [
    { title: t("home.step1_title"), text: t("home.step1_text") },
    { title: t("home.step2_title"), text: t("home.step2_text") },
    { title: t("home.step3_title"), text: t("home.step3_text") },
  ];

  return (
    <PublicShell>
      <SeoJsonLd
        data={webSiteJsonLd({
          name: brand.name,
          description: brand.description,
          url: getConfig().APP_URL,
        })}
      />
      <section className="home-hero overflow-hidden">
        <Container className="logo-hang-band grid items-center gap-8 pb-8 pt-8 sm:gap-10 sm:pb-12 sm:pt-10 lg:grid-cols-[1.15fr_0.85fr] lg:pb-16 lg:pt-12 xl:pb-20 xl:pt-16">
          <div>
            <p className="inline-flex rounded-full bg-gold px-4 py-2 text-sm font-extrabold text-brand">
              {t("home.badge")}
            </p>
            <h1 className="font-heading mt-5 text-[clamp(1.85rem,5vw+0.6rem,3.75rem)] font-bold tracking-tight text-pretty text-brand">
              {t("home.title")}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg sm:leading-8 xl:text-xl">
              {t("home.description")}
            </p>
            <p className="mt-4 max-w-xl text-sm font-bold text-brand">
              {t("home.guest_note")}
            </p>
            <form
              action="/teachers"
              method="get"
              className="mt-6 flex flex-col gap-3 sm:flex-row"
            >
              <label className="block flex-1">
                <span className="sr-only">{t("home.search_label")}</span>
                <input
                  name="q"
                  className="min-h-12 w-full rounded-full border border-line bg-surface px-5 text-base font-semibold text-brand shadow-[var(--shadow-card)]"
                  placeholder={t("home.search_placeholder")}
                />
              </label>
              <button
                type="submit"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white"
              >
                {t("home.search_button")}
              </button>
            </form>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ButtonLink href="/teachers" size="lg" className="w-full sm:w-auto">
                {t("home.cta_teacher")}
              </ButtonLink>
              <ButtonLink
                href="/register?role=parent"
                size="lg"
                variant="secondary"
                className="w-full sm:w-auto"
              >
                {t("home.cta_parent")}
              </ButtonLink>
              <ButtonLink
                href="/register?role=student"
                size="lg"
                variant="secondary"
                className="w-full sm:w-auto"
              >
                {t("home.cta_student")}
              </ButtonLink>
              <ButtonLink
                href="/teach"
                size="lg"
                variant="secondary"
                className="w-full sm:w-auto"
              >
                {t("home.cta_teach")}
              </ButtonLink>
            </div>
            <ul className="mt-8 grid gap-3 text-sm font-bold text-brand xs:grid-cols-1 sm:grid-cols-3">
              <li className="rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
                {t("home.pill_1")}
              </li>
              <li className="rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
                {t("home.pill_2")}
              </li>
              <li className="rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
                {t("home.pill_3")}
              </li>
            </ul>
          </div>

          <div className="min-w-0">
            {showcase ? (
              <FeaturedTeacherShowcase
                teacher={{
                  userId: showcase.userId,
                  displayName: showcase.displayName,
                  headline: showcase.headline,
                  subjects:
                    showcase.subjects.map((item) => item.name).join(" · ") ||
                    t("home.featured_teacher"),
                  photoUrl: showcase.photoUrl,
                  video: showcase.video,
                }}
                watchLabel={t("home.watch_intro")}
                profileLabel={t("home.open_profile")}
              />
            ) : (
              <FeaturedTeacherShowcase
                teacher={{
                  href: "/teachers",
                  displayName: sampleShowcase.name,
                  headline: sampleShowcase.level,
                  subjects: sampleShowcase.subjects,
                  photoUrl: sampleShowcase.photoUrl,
                  video: sampleShowcase.video,
                }}
                watchLabel={t("home.watch_intro")}
                profileLabel={t("home.open_profile")}
              />
            )}
          </div>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container>
          <SectionHeading
            eyebrow={t("home.subjects_eyebrow")}
            title={t("home.subjects_title")}
            description={t("home.subjects_description")}
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            {subjects.map((subject) => (
              <a
                key={subject.slug}
                href={`/subjects/${subject.slug}`}
                className={`rounded-[var(--radius-card)] p-5 ${tones[subject.tone]} transition hover:-translate-y-0.5`}
              >
                <h3 className="text-xl font-extrabold text-brand">
                  {subject.name}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {subject.summary}
                </p>
              </a>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-surface py-16 sm:py-20">
        <Container>
          <SectionHeading
            eyebrow={t("home.how_eyebrow")}
            title={t("home.how_title")}
            description={t("home.how_description")}
          />
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="rounded-[var(--radius-card)] border border-line bg-background p-6"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-lg font-extrabold text-brand-accent">
                  {index + 1}
                </span>
                <h3 className="mt-5 text-xl font-extrabold text-brand">
                  {step.title}
                </h3>
                <p className="mt-2 text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {announcements.length > 0 ? (
        <section className="border-y border-line bg-mint/50 py-12">
          <Container>
            <SectionHeading
              eyebrow={t("news.eyebrow")}
              title={t("news.title")}
              description={t("news.description")}
            />
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {announcements.map((item) => (
                <article
                  key={item.id}
                  className="rounded-[var(--radius-card)] border border-line bg-surface p-6"
                >
                  <h3 className="text-xl font-extrabold text-brand">{item.title}</h3>
                  {item.excerpt ? (
                    <p className="mt-2 text-muted">{item.excerpt}</p>
                  ) : null}
                  <p className="mt-4">
                    <ButtonLink href={item.href ?? `/news/${item.slug}`} variant="secondary">
                      {t("news.read")}
                    </ButtonLink>
                  </p>
                </article>
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      <section className="py-16 sm:py-20">
        <Container>
          <SectionHeading
            eyebrow={t("home.teachers_eyebrow")}
            title={t("home.teachers_title")}
            description={t("home.teachers_description")}
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {usingLiveTeachers
              ? liveCards.map((teacher) => (
                  <TeacherCard
                    key={teacher.userId}
                    name={teacher.displayName}
                    subjects={
                      teacher.subjects.map((item) => item.name).join(" · ") ||
                      teacher.headline ||
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
                    recommendationReasons={teacher.recommendation.reasons}
                    photoUrl={teacher.photoUrl}
                    videoThumbnailUrl={teacher.video?.playback?.thumbnailUrl}
                  />
                ))
              : sampleCards.map((teacher, index) => {
                  const recommendation = recommendTeacher({
                    displayName: teacher.name,
                    headline: teacher.level,
                    languages: teacher.languages,
                    subjects: teacher.subjectSlugs.map((slug) => ({
                      slug,
                      name: slug,
                    })),
                    rating: Number(teacher.rating),
                    reviewCount: teacher.reviewCount,
                    lessonsTaught: teacher.lessonsTaught,
                    responseRate: teacher.responseRate,
                    recommendPercent: teacher.recommendPercent,
                    hasVideo: teacher.hasVideo,
                    rateAmount: Number(teacher.rate.amount),
                  });
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
                      href="/teachers"
                      hasVideo={teacher.hasVideo}
                      gender={teacher.gender}
                      audiences={[...teacher.audiences]}
                      responseRate={teacher.responseRate}
                      featured={index === 0}
                      recommendationReasons={recommendation.reasons}
                      photoUrl={teacher.photoUrl}
                      videoThumbnailUrl={teacher.video.playback?.thumbnailUrl}
                    />
                  );
                })}
          </div>
          <div className="mt-10 text-center">
            <ButtonLink href="/teachers" variant="secondary">
              {t("home.browse_teachers")}
            </ButtonLink>
          </div>
        </Container>
      </section>

      <section className="bg-surface py-16 sm:py-20">
        <Container className="grid items-center gap-8 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <SectionHeading
              eyebrow={t("home.classroom")}
              title={t("classroom.integrated_title")}
              description={t("home.classroom_text", { name: brand.name })}
            />
            <p className="mt-5 text-sm font-semibold text-muted">
              {t("classroom.integrated_help")}
            </p>
          </div>
          <ClassroomPreview
            brand={brand}
            overlay={overlay}
            title={t("home.classroom")}
            body={t("home.classroom_text", { name: brand.name })}
            teacherLabel={t("classroom.role_teacher")}
            studentLabel={t("classroom.role_student")}
            studentTwoLabel={t("classroom.student_n", { n: 2 })}
            boardLabel={t("classroom.board")}
            cameraLabel={t("classroom.camera_on")}
            micLabel={t("classroom.mic_on")}
            shareLabel={t("classroom.sharing")}
            chatLabel={t("classroom.chat")}
            chatSample={t("classroom.chat_preview")}
            timerLabel={t("classroom.timer_left", { time: "24:00" })}
            recordingLabel={t("classroom.recording")}
            recordingSecureLabel={t("classroom.recording_secure")}
            filesLabel={t("classroom.files")}
            filesSample={t("classroom.files_preview")}
            slidesLabel={t("classroom.slides")}
            slidesSample={t("classroom.slides_preview")}
            bookLabel={t("classroom.book")}
            bookSample={t("classroom.book_preview")}
            readerSample={t("classroom.reader_preview")}
            boardTools={t("classroom.board_preview")}
          />
        </Container>
      </section>

      <section className="border-y border-line bg-gold/60 py-16 sm:py-20">
        <Container className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionHeading
              eyebrow={t("home.safe_eyebrow")}
              title={t("home.safe_title")}
            />
            <p className="mt-5 text-lg leading-8 text-muted">
              {t("home.safe_text")}
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              t("home.safe_1"),
              t("home.safe_2"),
              t("home.safe_3"),
              t("home.safe_4"),
            ].map((item) => (
              <li
                key={item}
                className="rounded-2xl bg-surface px-5 py-4 font-bold text-brand shadow-[var(--shadow-card)]"
              >
                {item}
              </li>
            ))}
          </ul>
        </Container>
      </section>
    </PublicShell>
  );
}
