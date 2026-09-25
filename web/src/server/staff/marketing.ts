import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { locales, marketingCampaigns } from "@/db/schema";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import type { CreateCampaignInput, UpdateCampaignInput } from "./schemas";

function optionalDate(value?: string) {
  if (!value?.trim()) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(422, "VALIDATION", "Enter a valid date");
  }
  return date;
}

export async function listMarketingWorkspace() {
  const [campaigns, localeRows] = await Promise.all([
    db
      .select()
      .from(marketingCampaigns)
      .orderBy(desc(marketingCampaigns.createdAt))
      .limit(100),
    db
      .select({
        code: locales.code,
        name: locales.name,
      })
      .from(locales)
      .where(eq(locales.isEnabled, true)),
  ]);

  return {
    locales: localeRows,
    summary: {
      total: campaigns.length,
      active: campaigns.filter((item) => item.status === "active").length,
      draft: campaigns.filter((item) => item.status === "draft").length,
      ended: campaigns.filter((item) => item.status === "ended").length,
    },
    campaigns,
  };
}

export async function createCampaign(
  actor: ApiActor,
  input: CreateCampaignInput,
  ip: string,
) {
  const [created] = await db
    .insert(marketingCampaigns)
    .values({
      name: input.name,
      channel: input.channel,
      locale: input.locale?.trim() || null,
      summary: input.summary?.trim() || null,
      startsAt: optionalDate(input.startsAt),
      endsAt: optionalDate(input.endsAt),
      createdByUserId: actor.userId,
    })
    .returning();

  if (!created) {
    throw new ApiError(500, "INTERNAL", "Could not create the campaign");
  }

  await writeAuditLog({
    actor,
    action: "marketing.campaign_created",
    entityType: "marketing_campaign",
    entityId: created.id,
    ipAddress: ip,
    metadata: { channel: input.channel },
  });

  return created;
}

export async function updateCampaign(
  actor: ApiActor,
  id: string,
  input: UpdateCampaignInput,
  ip: string,
) {
  const [updated] = await db
    .update(marketingCampaigns)
    .set({
      status: input.status,
      ...(input.summary !== undefined ? { summary: input.summary.trim() || null } : {}),
    })
    .where(eq(marketingCampaigns.id, id))
    .returning();

  if (!updated) {
    throw new ApiError(404, "NOT_FOUND", "Campaign not found");
  }

  await writeAuditLog({
    actor,
    action: "marketing.campaign_updated",
    entityType: "marketing_campaign",
    entityId: id,
    ipAddress: ip,
    metadata: { status: input.status },
  });

  return updated;
}
