import { apiRoute } from "@/server/api/handler";
import {
  updateReminderSettings,
  updateReminderSettingsSchema,
} from "@/server/communications/settings";

export const runtime = "nodejs";

export const PATCH = apiRoute(
  {
    auth: "session",
    permission: "settings.write",
    rateLimit: "sensitive",
    input: updateReminderSettingsSchema,
  },
  async ({ actor, input, ip }) => updateReminderSettings(actor!, input, ip),
);
