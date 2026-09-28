import { ButtonLink } from "@/components/ui/button";
import { ClassroomJoinButton } from "@/components/classroom/classroom-join-button";
import type { BookingView } from "@/lib/booking";
import { getI18n } from "@/server/i18n/locale";

export async function UpcomingLessonCard({
  lesson,
  href,
  withName,
  role,
}: {
  lesson: BookingView | null;
  href: string;
  withName?: "teacher" | "student";
  role?: string;
}) {
  const { t } = await getI18n();

  return (
    <section className="rounded-[2rem] border border-line bg-surface p-6 shadow-[var(--shadow-card)]">
      <h2 className="text-xl font-extrabold text-brand">{t("booking.next")}</h2>
      {lesson ? (
        <>
          <p className="mt-2 text-xs font-bold uppercase text-brand-soft">
            {lesson.formatLabel} ·{" "}
            {t(
              lesson.bookingMode === "package"
                ? "booking.mode_package"
                : lesson.bookingMode === "recurring"
                  ? "booking.mode_recurring"
                  : "booking.mode_single",
            )}{" "}
            · {lesson.kindLabel}
          </p>
          <p className="mt-1 text-lg font-extrabold text-brand">{lesson.whenLabel}</p>
          <p className="mt-1 text-sm font-semibold text-brand">
            {withName === "student"
              ? t("booking.with_student", { name: lesson.studentName })
              : t("booking.with_teacher", { name: lesson.teacherName })}
            {lesson.subjectName ? ` · ${lesson.subjectName}` : ""}
          </p>
          <p className="mt-1 text-sm text-muted">
            {lesson.durationMinutes} {t("booking.minutes")}
            {lesson.amountFormatted ? ` · ${lesson.amountFormatted}` : ""}
            {lesson.listedPriceFormatted
              ? ` · ${t("card.listed_as", { price: lesson.listedPriceFormatted })}`
              : ""}
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm leading-6 text-muted">{t("booking.next_empty")}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {lesson ? (
          <ClassroomJoinButton
            className="w-full"
            href={lesson.classroomHref}
            joinable={lesson.classroomJoinable}
            startsAt={lesson.startsAt}
            endsAt={lesson.endsAt}
            status={lesson.status}
            kind="booking"
            role={role}
            timeZone={lesson.timezone}
          />
        ) : null}
        <ButtonLink href={href} variant="secondary">
          {t("booking.open_calendar")}
        </ButtonLink>
      </div>
    </section>
  );
}
