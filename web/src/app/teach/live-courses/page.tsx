import { eq } from "drizzle-orm";
import { LiveCourseForm } from "@/components/bookings/live-course-form";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { db } from "@/db";
import { subjects, teacherProfiles, teacherSubjects } from "@/db/schema";
import { listTeacherLiveCourses } from "@/server/booking/live-courses";
import { requireApprovedTeacher } from "@/server/rbac/guard";

export const metadata = { title: "Live courses" };

export default async function TeacherLiveCoursesPage() {
  const access = await requireApprovedTeacher();
  const [offered, [profile], courses] = await Promise.all([
    db
      .select({ slug: subjects.slug, name: subjects.name })
      .from(teacherSubjects)
      .innerJoin(subjects, eq(subjects.slug, teacherSubjects.subjectSlug))
      .where(eq(teacherSubjects.teacherUserId, access.user.id)),
    db
      .select({ currencyCode: teacherProfiles.currencyCode })
      .from(teacherProfiles)
      .where(eq(teacherProfiles.userId, access.user.id))
      .limit(1),
    listTeacherLiveCourses(access.user.id),
  ]);
  return (
    <TeacherWorkspaceShell>
      <PageHero
        eyebrow="Cohort teaching"
        title="Live courses"
        description="Publish a weekly multi-session course. One enrollment reserves every session."
      />
      <Container className="space-y-8 py-10">
        <LiveCourseForm
          teacherUserId={access.user.id}
          subjects={offered}
          currencyCode={profile?.currencyCode ?? "USD"}
        />
        <section>
          <h2 className="text-2xl font-extrabold text-brand">Your live courses</h2>
          {courses.length ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {courses.map((course) => (
                <article key={course.id} className="rounded-[1.5rem] border border-line bg-surface p-5">
                  <p className="text-xs font-bold uppercase text-brand-soft">
                    {course.subjectName} · {course.status}
                  </p>
                  <h3 className="mt-1 text-xl font-extrabold text-brand">{course.title}</h3>
                  <p className="mt-2 font-semibold text-brand">{course.firstWhenLabel}</p>
                  <p className="mt-1 text-sm text-muted">
                    {course.sessionCount} sessions · {course.enrolledCount}/{course.capacity} enrolled · {course.amountFormatted}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-2xl bg-gold px-4 py-3 font-semibold text-brand">
              No live courses published yet.
            </p>
          )}
        </section>
      </Container>
    </TeacherWorkspaceShell>
  );
}
