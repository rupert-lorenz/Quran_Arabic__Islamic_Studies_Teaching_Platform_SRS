import { notFound } from "next/navigation";
import { GroupLessonCard } from "@/components/bookings/group-lesson-card";
import { PublicShell } from "@/components/layout/public-shell";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { formatLessonDuration } from "@/lib/booking";
import { getServerUser } from "@/server/auth/session";
import { bookingViewerForTeacherPage } from "@/server/booking/service";
import {
  getPublicGroupClass,
  listActorGroupEnrollmentIds,
} from "@/server/booking/group-lessons";
import { pageMetadata } from "@/server/cms/seo";
import { getI18n } from "@/server/i18n/locale";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getServerUser();
  const [{ t }, data] = await Promise.all([
    getI18n(),
    getPublicGroupClass(id, user?.id),
  ]);
  if (!data) {
    return pageMetadata({
      title: t("group.title"),
      description: t("group.description"),
      path: `/group-lessons/${id}`,
    });
  }
  return pageMetadata({
    title: data.class.title,
    description: t("group.schedule_description", { title: data.class.title }),
    path: data.class.href,
  });
}

export default async function GroupClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getServerUser();
  const [{ t }, data, viewer] = await Promise.all([
    getI18n(),
    getPublicGroupClass(id, user?.id),
    bookingViewerForTeacherPage(
      user ? { id: user.id, roleKey: user.roleKey } : null,
    ),
  ]);
  if (!data) {
    notFound();
  }
  const enrollments = user
    ? await listActorGroupEnrollmentIds({
        userId: user.id,
        roleKey: user.roleKey,
        permissions: [],
      })
    : [];
  const { class: groupClass, sessions } = data;

  return (
    <PublicShell>
      <PageHero
        eyebrow={groupClass.subjectName}
        title={groupClass.title}
        description={t("group.schedule_description", { title: groupClass.title })}
      >
        <Breadcrumbs
          items={[
            { href: "/", label: t("crumb.home") },
            { href: "/group-lessons", label: t("group.title") },
            { label: groupClass.title },
          ]}
        />
      </PageHero>
      <Container className="space-y-8 py-12">
        <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-sm font-bold text-muted">{t("group.teacher")}</dt>
              <dd className="mt-1 font-heading text-lg font-bold tracking-tight text-brand">
                {groupClass.teacherName}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-bold text-muted">{t("group.length")}</dt>
              <dd className="mt-1 font-heading text-lg font-bold tracking-tight text-brand">
                {formatLessonDuration(groupClass.durationMinutes)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-bold text-muted">{t("group.schedule")}</dt>
              <dd className="mt-1 font-heading text-lg font-bold tracking-tight text-brand">
                {groupClass.scheduleLabel || groupClass.nextWhenLabel}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-bold text-muted">{t("group.hourly_rate")}</dt>
              <dd className="mt-1 font-heading text-lg font-bold tracking-tight text-brand">
                {t("group.price_per_session", {
                  price: groupClass.studentPriceFormatted,
                })}
              </dd>
            </div>
          </dl>
          <div className="mt-5">
            <ButtonLink href="/group-lessons" variant="secondary">
              {t("group.back_to_classes")}
            </ButtonLink>
          </div>
        </section>
        <section>
          <h2 className="font-heading text-2xl font-bold tracking-tight text-brand">
            {t("group.daily_schedule")}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {t("group.sessions_count", { count: sessions.length })}
          </p>
          <div className="mt-5 grid gap-4">
            {sessions.map((lesson) => (
              <GroupLessonCard
                key={lesson.id}
                lesson={lesson}
                viewer={viewer}
                layout="session"
                enrollments={enrollments.filter(
                  (item) => item.groupLessonId === lesson.id,
                )}
              />
            ))}
          </div>
        </section>
      </Container>
    </PublicShell>
  );
}
