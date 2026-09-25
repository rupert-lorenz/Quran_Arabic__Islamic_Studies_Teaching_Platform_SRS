import { TeacherCard } from "@/components/teachers/teacher-card";
import { parseAudienceList } from "@/lib/teacher-search";
import type { listPublicTeachers } from "@/server/teacher/public";

type PublicTeacher = Awaited<ReturnType<typeof listPublicTeachers>>[number];

export function CatalogTeachers({
  teachers,
  empty,
}: {
  teachers: PublicTeacher[];
  empty: string;
}) {
  if (teachers.length === 0) {
    return (
      <p className="rounded-[2rem] bg-gold px-5 py-4 font-semibold text-brand">
        {empty}
      </p>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
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
        />
      ))}
    </div>
  );
}
