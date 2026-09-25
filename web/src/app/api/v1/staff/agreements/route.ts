import { apiRoute } from "@/server/api/handler";
import { writeAuditLog } from "@/server/api/audit";
import { ensureCurrentAgreementVersion, publishAgreementVersion } from "@/server/teacher/agreement";
import { publishTeacherAgreementSchema } from "@/server/teacher/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    permission: ["teachers.approve", "teachers.documents.review"],
    rateLimit: "sensitive",
  },
  async () => ensureCurrentAgreementVersion(),
);

export const POST = apiRoute(
  {
    auth: "session",
    permission: "teachers.approve",
    rateLimit: "sensitive",
    input: publishTeacherAgreementSchema,
  },
  async ({ actor, input, ip }) => {
    const current = await publishAgreementVersion({
      ...input,
      publishedByUserId: actor!.userId,
    });
    await writeAuditLog({
      actor: actor!,
      action: "teachers.agreement_published",
      entityType: "teacher_agreement_version",
      entityId: current.version,
      ipAddress: ip,
    });
    return current;
  },
);
