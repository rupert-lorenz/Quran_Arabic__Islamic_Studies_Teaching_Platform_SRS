import { ClassroomRecordingLibrary } from "@/components/classroom/classroom-recording-library";
import { SafeguardingWorkspace } from "@/components/staff/safeguarding-workspace";
import { StaffRecordingRetention } from "@/components/staff/staff-recording-retention";
import { Container } from "@/components/ui/container";
import { hasAnyPermission } from "@/lib/rbac";
import { listAccessibleRecordings } from "@/server/classroom/recording-access";
import { requireStaffPage } from "@/server/rbac/guard";
import { listSafeguardingWorkspace } from "@/server/staff/safeguarding";

export const metadata = {
  title: "Safeguarding",
};

export default async function StaffSafeguardingPage() {
  const access = await requireStaffPage([
    "safeguarding.incidents",
    "safeguarding.recordings",
  ]);
  const canRecordings = hasAnyPermission(access, "safeguarding.recordings");
  const [workspace, library] = await Promise.all([
    listSafeguardingWorkspace(),
    canRecordings
      ? listAccessibleRecordings({
          userId: access.user.id,
          roleKey: access.user.roleKey,
          permissions: access.permissions,
        })
      : Promise.resolve({ recordings: [], retentionDays: 365, canRetain: false }),
  ]);
  const canReadAudit = hasAnyPermission(access, "audit.read");

  return (
    <Container className="py-10">
      <h1 className="text-3xl font-extrabold text-brand">Safeguarding</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Restricted incident and recording reviews. Other staff roles cannot open
        this workspace.
      </p>
      <div className="mt-8">
        <SafeguardingWorkspace
          initial={{
            ...workspace,
            recentAudit: canReadAudit ? workspace.recentAudit : [],
          }}
          canIncidents={hasAnyPermission(access, "safeguarding.incidents")}
          canRecordings={canRecordings}
          canSuspend={hasAnyPermission(access, "users.suspend")}
          canReadAudit={canReadAudit}
        />
      </div>
      {canRecordings ? (
        <div className="mt-8 grid gap-6">
          <StaffRecordingRetention initialDays={library.retentionDays} />
          <ClassroomRecordingLibrary
            recordings={library.recordings}
            retentionDays={library.retentionDays}
          />
        </div>
      ) : null}
    </Container>
  );
}
