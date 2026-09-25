import { RecordLessonForm } from "@/components/staff/record-lesson-form";
import { Container } from "@/components/ui/container";
import { requireStaffPage } from "@/server/rbac/guard";
import { listEnabledSubjects } from "@/server/student/profile";
import { listRecentLessonHistory } from "@/server/student/lessons";

export const metadata = {
  title: "Lesson history",
};

export default async function StaffLessonsPage() {
  await requireStaffPage(["classes.manage", "students.manage"]);
  const [catalog, history] = await Promise.all([
    listEnabledSubjects(),
    listRecentLessonHistory(),
  ]);

  return (
    <Container className="py-10">
      <h1 className="text-3xl font-extrabold text-brand">Lesson history</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Record classes against a student profile. Completing a booked lesson
        also writes here automatically.
      </p>
      <div className="mt-8">
        <RecordLessonForm catalog={catalog} initialLessons={history.lessons} />
      </div>
    </Container>
  );
}
