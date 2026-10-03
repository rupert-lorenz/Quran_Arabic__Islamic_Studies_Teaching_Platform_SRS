import { desc } from "drizzle-orm";
import { db } from "@/db";
import { marketingCampaigns } from "@/db/schema";
import { isStaffRole } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";

function visible<T extends { status: string }>(actor: ApiActor, rows: T[]) {
  if (isStaffRole(actor.roleKey)) return rows;
  return rows.filter((row) => row.status === "active");
}

export async function getOfferFaculties(actor: ApiActor) {
  const rows = await db
    .select({
      id: marketingCampaigns.id,
      name: marketingCampaigns.name,
      status: marketingCampaigns.status,
      channel: marketingCampaigns.channel,
      summary: marketingCampaigns.summary,
      createdAt: marketingCampaigns.createdAt,
    })
    .from(marketingCampaigns)
    .orderBy(desc(marketingCampaigns.createdAt))
    .limit(100);

  const promoAll = rows.filter((row) => row.channel === "other");
  const referralAll = rows.filter((row) => row.channel === "referral");
  const promo = visible(actor, promoAll);
  const referral = visible(actor, referralAll);

  const pack = (
    source: typeof promo,
    all: typeof promoAll,
  ) => ({
    active: all.filter((row) => row.status === "active").length,
    draft: isStaffRole(actor.roleKey)
      ? all.filter((row) => row.status === "draft").length
      : 0,
    ended: isStaffRole(actor.roleKey)
      ? all.filter((row) => row.status === "ended").length
      : 0,
    total: isStaffRole(actor.roleKey) ? all.length : source.length,
    recent: source.slice(0, 8).map((row) => ({
      id: row.id,
      title: row.name,
      meta: [row.status.replaceAll("_", " "), row.summary]
        .filter(Boolean)
        .join(" · "),
    })),
  });

  return {
    promo: pack(promo, promoAll),
    referral: pack(referral, referralAll),
  };
}
