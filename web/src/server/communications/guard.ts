import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";

export const CONTACT_FLAG_CHANNELS = [
  "classroom",
  "whiteboard",
  "files",
  "messages",
] as const;

export type ContactFlagChannel = (typeof CONTACT_FLAG_CHANNELS)[number];

export async function flagContactShare(
  actor: ApiActor,
  channel: ContactFlagChannel,
) {
  await writeAuditLog({
    actor,
    action: "contact_share.flagged",
    entityType: "contact_guard",
    metadata: { channel },
  });
}
