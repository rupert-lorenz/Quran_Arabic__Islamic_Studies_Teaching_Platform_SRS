import { IntroVideoPlayer } from "@/components/teachers/intro-video-player";
import { PublicShell } from "@/components/layout/public-shell";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { exampleIntroVideoUrl, introVideoGuidance } from "@/lib/intro-video";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { SeoJsonLd } from "@/components/seo/seo-json-ld";
import { webPageJsonLd } from "@/lib/seo-schema";
import { pageMetadata } from "@/server/cms/seo";
import { getI18n } from "@/server/i18n/locale";
import { getAccessContext } from "@/server/rbac/guard";
import { listPublicTeachers } from "@/server/teacher/public";

export async function generateMetadata() {
  const { t } = await getI18n();
  return pageMetadata({
    title: t("teach.title"),
    description: t("teach.description"),
    path: "/teach",
  });
}

export default async function TeachPage() {
  const [featuredTeachers, access, { t }] = await Promise.all([
    listPublicTeachers(),
    getAccessContext(),
    getI18n(),
  ]);
  const featured = featuredTeachers.find((item) => item.video);
  const teacherHome = access?.user.roleKey === "teacher";
  const steps = [
    t("teach.step1"),
    t("teach.step2"),
    t("teach.step3"),
    t("teach.step4"),
    t("teach.step5"),
  ];

  return (
    <PublicShell>
      <SeoJsonLd
        data={webPageJsonLd({
          name: t("teach.title"),
          description: t("teach.description"),
          path: "/teach",
        })}
      />
      <PageHero
        eyebrow={t("teach.eyebrow")}
        title={t("teach.title")}
        description={t("teach.description")}
      >
        <Breadcrumbs
          items={[
            { href: "/", label: t("crumb.home") },
            { label: t("teach.title") },
          ]}
        />
      </PageHero>
      <Container className="grid gap-8 py-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
        <ol className="space-y-3">
          {steps.map((step, index) => (
            <li
              key={step}
              className="flex items-start gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-mint font-extrabold text-brand">
                {index + 1}
              </span>
              <p className="pt-1.5 font-bold text-brand">{step}</p>
            </li>
          ))}
        </ol>
        <aside className="h-fit rounded-[2rem] bg-brand p-6 text-white">
          <p className="text-sm font-extrabold text-brand-accent uppercase">
            {t("teach.earnings")}
          </p>
          <p className="mt-4 text-4xl font-extrabold">£15</p>
          <p className="text-white/75">{t("teach.student_pays")}</p>
          <p className="mt-4 font-bold">{t("teach.commission")}</p>
          <p className="mt-3 text-sm text-white/70">{t("teach.limits")}</p>
          <div className="mt-6">
            <ButtonLink
              href={teacherHome ? "/teach/home" : "/register?role=teacher"}
              className="w-full bg-white text-brand hover:bg-gold"
            >
              {teacherHome ? t("teach.open_dashboard") : t("teach.start_application")}
            </ButtonLink>
          </div>
        </aside>
        <section className="lg:col-span-2 rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <h2 className="text-xl font-extrabold text-brand">
            {t("teach.videos_title")}
          </h2>
          <p className="mt-2 text-sm text-muted">{t("teach.videos_text")}</p>
          <ul className="mt-4 list-disc space-y-1 ps-5 text-sm text-brand">
            {introVideoGuidance.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="mt-6 max-w-2xl">
            {featured?.video ? (
              <IntroVideoPlayer
                playback={featured.video.playback}
                url={featured.video.watchUrl}
                title={`${featured.displayName} introduction`}
              />
            ) : (
              <IntroVideoPlayer
                url={exampleIntroVideoUrl}
                title={t("teach.example_video")}
              />
            )}
            {!featured?.video ? (
              <p className="mt-3 text-xs font-semibold text-muted">
                {t("teach.example_note")}
              </p>
            ) : null}
          </div>
        </section>
      </Container>
    </PublicShell>
  );
}
