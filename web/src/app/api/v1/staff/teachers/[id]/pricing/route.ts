import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import {
  removeTeacherPricingControl,
  upsertTeacherPricingControl,
} from "@/server/staff/rates";
import { upsertPricingControlSchema } from "@/server/staff/schemas";
import { getTeacherApplication } from "@/server/teacher/applications";
import { listPricingControlRows } from "@/server/teacher/pricing";

export const runtime = "nodejs";

export const PATCH = apiRoute(
  {
    auth: "session",
    permission: "teachers.approve",
    rateLimit: "sensitive",
    input: upsertPricingControlSchema.omit({ scope: true, scopeKey: true }),
  },
  async ({ actor, input, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Teacher id is required");
    }
    await upsertTeacherPricingControl(
      actor!,
      { ...input, scope: "teacher", scopeKey: params.id },
      ip,
    );
    return getTeacherApplication(params.id);
  },
);

export const DELETE = apiRoute(
  {
    auth: "session",
    permission: "teachers.approve",
    rateLimit: "sensitive",
  },
  async ({ actor, params, ip }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Teacher id is required");
    }
    const rules = await listPricingControlRows();
    const current = rules.find(
      (rule) => rule.scope === "teacher" && rule.scopeKey === params.id,
    );
    if (current?.id) {
      await removeTeacherPricingControl(actor!, current.id, ip);
    }
    return getTeacherApplication(params.id);
  },
);
