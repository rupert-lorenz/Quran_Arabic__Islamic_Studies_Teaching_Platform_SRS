import { redirect } from "next/navigation";
import { ClassroomOverlay } from "@/components/classroom/classroom-overlay";
import { ButtonLink } from "@/components/ui/button";
import { ClassroomRoom } from "@/components/classroom/classroom-room";
import { isApiError } from "@/server/api/errors";
import { getClassroomOverlay } from "@/server/classroom/brand";
import { getClassroomSession } from "@/server/classroom/service";
import { getI18n } from "@/server/i18n/locale";
import { getAccessContext, signedInHome } from "@/server/rbac/guard";
import type { UiMessageKey } from "@/lib/i18n";

export const metadata = {
  title: "Classroom",
};

function sessionErrorKey(error: unknown): UiMessageKey {
  if (!isApiError(error)) return "classroom.join_failed";
  if (error.code === "CLASSROOM_NOT_OPEN") return "classroom.not_open";
  if (error.code === "CLASSROOM_ENDED") return "classroom.ended";
  if (error.code === "CLASSROOM_CLOSED") return "classroom.closed";
  if (error.code === "FORBIDDEN") return "classroom.forbidden";
  if (error.code === "NOT_FOUND") return "classroom.missing";
  return "classroom.join_failed";
}

export default async function ClassroomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, access, { brand, t }, overlay] = await Promise.all([
    params,
    getAccessContext(),
    getI18n(),
    getClassroomOverlay(),
  ]);
  if (!access) {
    redirect("/login");
  }
  const leaveHref = signedInHome(access);
  let session;
  let error: unknown;
  try {
    session = await getClassroomSession(
      {
        userId: access.user.id,
        roleKey: access.user.roleKey,
        permissions: access.permissions,
        displayName: access.user.displayName,
      },
      id,
    );
  } catch (caught) {
    error = caught;
  }
  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">
        <ClassroomOverlay brand={brand} overlay={overlay} placement="bar" />
        <h1 className="mt-6 text-2xl font-extrabold text-brand">{t("classroom.title")}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{t(sessionErrorKey(error))}</p>
        <div className="mt-6">
          <ButtonLink href={leaveHref} variant="secondary">
            {t("classroom.back")}
          </ButtonLink>
        </div>
      </main>
    );
  }
  return (
    <ClassroomRoom
      initial={session}
      brand={brand}
      overlay={overlay}
      leaveHref={leaveHref}
    />
  );
}
