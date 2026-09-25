import { eq } from "drizzle-orm";
import { GroupLessonForm } from "@/components/bookings/group-lesson-form";
import { GroupLessonManager } from "@/components/bookings/group-lesson-manager";
import { GroupTeachingSettings } from "@/components/bookings/group-teaching-settings";
import { TeacherGroupOpportunityBoard } from "@/components/bookings/teacher-group-opportunity-board";
import { TeacherWorkspaceShell } from "@/components/teachers/teacher-workspace-shell";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { db } from "@/db";
import { subjects, teacherProfiles, teacherSubjects } from "@/db/schema";
import { listTeacherGroupClassOpportunities } from "@/server/booking/group-class-opportunities";
import { listTeacherGroupLessons } from "@/server/booking/group-lessons";
import { requireApprovedTeacher } from "@/server/rbac/guard";
import { getTeacherRateLimits } from "@/server/teacher/profile";

export const metadata = { title: "Group lessons" };

export default async function TeacherGroupLessonsPage() {
  const access = await requireApprovedTeacher();
  const [offered, [profile], lessons, rateLimits, opportunities] = await Promise.all([
    db
      .select({ slug: subjects.slug, name: subjects.name })
      .from(teacherSubjects)
      .innerJoin(subjects, eq(subjects.slug, teacherSubjects.subjectSlug))
      .where(eq(teacherSubjects.teacherUserId, access.user.id)),
    db
      .select({
        currencyCode: teacherProfiles.currencyCode,
        offersGroupTeaching: teacherProfiles.offersGroupTeaching,
        defaultGroupCapacity: teacherProfiles.defaultGroupCapacity,
        defaultGroupMinStudents: teacherProfiles.defaultGroupMinStudents,
      })
      .from(teacherProfiles)
      .where(eq(teacherProfiles.userId, access.user.id))
      .limit(1),
    listTeacherGroupLessons(access.user.id),
    getTeacherRateLimits(),
    listTeacherGroupClassOpportunities(access.user.id),
  ]);

  return (
    <TeacherWorkspaceShell>
      <PageHero
        eyebrow="Teaching schedule"
        title="Group lessons"
        description="Publish a scheduled class for multiple students. Each learner reserves one place."
      />
      <Container className="space-y-8 py-10">
        <GroupTeachingSettings
          initialEnabled={profile?.offersGroupTeaching ?? false}
          initialCapacity={profile?.defaultGroupCapacity ?? 6}
          initialMinStudents={profile?.defaultGroupMinStudents ?? 2}
        />
        {profile?.offersGroupTeaching ? (
          <TeacherGroupOpportunityBoard initial={opportunities} />
        ) : null}
        {profile?.offersGroupTeaching ? (
          <GroupLessonForm
            teacherUserId={access.user.id}
            subjects={offered}
            currencyCode={profile.currencyCode ?? "USD"}
            defaultCapacity={profile.defaultGroupCapacity}
            defaultMinStudents={profile.defaultGroupMinStudents}
            commissionPercent={rateLimits.commissionPercent}
          />
        ) : (
          <p className="rounded-2xl bg-gold px-5 py-4 font-semibold text-brand">
            Enable group teaching above before publishing classes.
          </p>
        )}
        <GroupLessonManager initial={lessons} />
      </Container>
    </TeacherWorkspaceShell>
  );
}
