"use client";

import { useState } from "react";
import { GroupLessonForm } from "@/components/bookings/group-lesson-form";
import { fieldClass } from "@/lib/api";

type AdminGroupTeacher = {
  userId: string;
  displayName: string;
  currencyCode: string;
  defaultGroupCapacity: number;
  defaultGroupMinStudents: number;
  subjects: { slug: string; name: string }[];
};

export function AdminGroupClassCreator({
  teachers,
  commissionPercent = 20,
}: {
  teachers: AdminGroupTeacher[];
  commissionPercent?: number;
}) {
  const [teacherUserId, setTeacherUserId] = useState(
    teachers[0]?.userId ?? "",
  );
  const teacher = teachers.find((item) => item.userId === teacherUserId);

  if (!teachers.length) {
    return (
      <section className="rounded-[2rem] bg-gold px-5 py-4 font-semibold text-brand">
        No approved teachers have enabled group teaching yet.
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-2xl font-extrabold text-brand">
          Admin-created group classes
        </h2>
        <p className="mt-2 text-sm text-muted">
          Select an opted-in teacher. Their subjects, currency, availability,
          and capacity defaults will be enforced. Set a student price and a
          separate teacher payment; students never see the teacher amount.
        </p>
        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-bold text-brand">Teacher</span>
          <select
            className={fieldClass}
            value={teacherUserId}
            onChange={(event) => setTeacherUserId(event.target.value)}
          >
            {teachers.map((item) => (
              <option key={item.userId} value={item.userId}>
                {item.displayName}
              </option>
            ))}
          </select>
        </label>
      </div>
      {teacher ? (
        <GroupLessonForm
          key={teacher.userId}
          teacherUserId={teacher.userId}
          subjects={teacher.subjects}
          currencyCode={teacher.currencyCode}
          defaultCapacity={teacher.defaultGroupCapacity}
          defaultMinStudents={teacher.defaultGroupMinStudents}
          commissionPercent={commissionPercent}
          adminMode
        />
      ) : null}
    </section>
  );
}
