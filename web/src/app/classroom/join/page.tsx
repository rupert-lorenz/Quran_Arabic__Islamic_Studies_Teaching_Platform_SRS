import Link from "next/link";
import { redirect } from "next/navigation";
import { ClassroomJoinButton } from "@/components/classroom/classroom-join-button";
import { ClassroomOverlay } from "@/components/classroom/classroom-overlay";
import { ButtonLink } from "@/components/ui/button";
import { classroomTimesFromDetails } from "@/lib/classroom";
import { isApiError } from "@/server/api/errors";
import { getClassroomOverlay } from "@/server/classroom/brand";
import { joinClassroom } from "@/server/classroom/service";
import { getI18n } from "@/server/i18n/locale";
import { getAccessContext } from "@/server/rbac/guard";
import type { UiMessageKey } from "@/lib/i18n";

export const metadata = {
  title: "Join classroom",
};

function joinErrorKey(error: unknown): UiMessageKey {
  if (!isApiError(error)) return "classroom.join_failed";
  if (error.code === "CLASSROOM_NOT_OPEN") return "classroom.not_open";
  if (error.code === "CLASSROOM_ENDED") return "classroom.ended";
  if (error.code === "CLASSROOM_CLOSED") return "classroom.closed";
  if (error.code === "FORBIDDEN") return "classroom.forbidden";
  if (error.code === "NOT_FOUND") return "classroom.missing";
  return "classroom.join_failed";
}

export default async function ClassroomJoinPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string; groupLessonId?: string }>;
}) {
  const [{ bookingId, groupLessonId }, access, { brand, t }, overlay] =
    await Promise.all([
      searchParams,
      getAccessContext(),
      getI18n(),
      getClassroomOverlay(),
    ]);
  if (!access) {
    redirect("/login");
  }
  if (!bookingId && !groupLessonId) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">
        <ClassroomOverlay brand={brand} overlay={overlay} placement="bar" />
        <h1 className="mt-6 text-2xl font-extrabold text-brand">{t("classroom.title")}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{t("classroom.missing")}</p>
        <div className="mt-6">
          <ButtonLink href="/" variant="secondary">
            {t("classroom.back")}
          </ButtonLink>
        </div>
      </main>
    );
  }

  let session;
  let error: unknown;
  try {
    session = await joinClassroom(
      {
        userId: access.user.id,
        roleKey: access.user.roleKey,
        permissions: access.permissions,
        displayName: access.user.displayName,
      },
      { bookingId, groupLessonId },
    );
  } catch (caught) {
    error = caught;
  }
  if (!session) {
    const wait = isApiError(error) ? classroomTimesFromDetails(error.details) : null;
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">
        <ClassroomOverlay brand={brand} overlay={overlay} placement="bar" />
        <h1 className="mt-6 font-heading text-2xl font-bold tracking-tight text-brand">
          {t("classroom.title")}
        </h1>
        {wait ? (
          <div className="mt-5 rounded-2xl border border-line bg-surface px-4 py-4">
            <ClassroomJoinButton
              startsAt={wait.startsAt}
              endsAt={wait.endsAt}
              role={access.user.roleKey}
              allowed
            />
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-muted">{t(joinErrorKey(error))}</p>
        )}
        <p className="mt-4 text-sm font-semibold text-brand">
          <Link href="/family/bookings" className="underline">
            {t("classroom.back")}
          </Link>
        </p>
      </main>
    );
  }
  redirect(`/classroom/${session.classroom.id}`);
}
