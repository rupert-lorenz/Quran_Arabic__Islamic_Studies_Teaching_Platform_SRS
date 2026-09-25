import { apiRoute } from "@/server/api/handler";
import {
  getRecordingRetentionDays,
  updateRecordingRetentionDays,
} from "@/server/classroom/recording-access";
import { updateRecordingRetentionSchema } from "@/server/staff/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    permission: ["safeguarding.recordings", "settings.write"],
    rateLimit: "sensitive",
  },
  async () => ({
    retentionDays: await getRecordingRetentionDays(),
  }),
);

export const PUT = apiRoute(
  {
    auth: "session",
    permission: ["safeguarding.recordings", "settings.write"],
    rateLimit: "sensitive",
    input: updateRecordingRetentionSchema,
  },
  async ({ actor, input, ip }) =>
    updateRecordingRetentionDays(actor!, input.retentionDays, ip),
);
