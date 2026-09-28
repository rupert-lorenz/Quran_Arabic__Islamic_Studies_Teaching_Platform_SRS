import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  currencies,
  librarySubscriptionPlanItems,
  librarySubscriptionPlans,
  librarySubscriptions,
  parentChildren,
  studentProfiles,
  teachingMaterials,
  users,
} from "@/db/schema";
import { presentStudentAmount } from "@/lib/currency";
import { hasAnyPermission } from "@/lib/rbac";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";
import { getRequestMoney } from "@/server/money/currency";
import { parseNonNegativeMajorAmount } from "@/server/staff/money";
import { findUserByEmail } from "@/server/staff/lookup";

export const MONTHLY_SUBSCRIPTION_DAYS = 30;

export type LibrarySubscriptionSeatView = {
  id: string;
  studentUserId: string;
  studentName: string;
  startsAt: string;
  expiresAt: string | null;
  status: "active" | "ended";
};

export type LibrarySubscriptionPlanView = {
  key: string;
  name: string;
  description: string | null;
  defaultDays: number | null;
  monthly: boolean;
  amountMinor: number;
  currencyCode: string | null;
  amountFormatted: string | null;
  listedPriceFormatted: string | null;
  isEnabled: boolean;
  subscriberCount: number;
  materials: Array<{ id: string; title: string }>;
  subscriptions: LibrarySubscriptionSeatView[];
};

export type LibrarySubscriptionDesk = {
  plans: LibrarySubscriptionPlanView[];
  materials: Array<{ id: string; title: string }>;
  currencies: Array<{ code: string; symbol: string; decimalPlaces: number }>;
  defaultCurrencyCode: string;
};

export type LearnerSubscriptionView = {
  planKey: string;
  planName: string;
  startsAt: string;
  expiresAt: string | null;
  monthly: boolean;
  amountFormatted: string | null;
  listedPriceFormatted: string | null;
};

function requireManager(actor: ApiActor) {
  if (!hasAnyPermission(actor, "academic.curriculum")) {
    throw new ApiError(403, "FORBIDDEN", "You cannot manage library subscriptions");
  }
}

function stillValid(expiresAt: Date | null, status?: "active" | "ended") {
  if (status === "ended") return false;
  return !expiresAt || expiresAt.getTime() > Date.now();
}

function slugKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function parseOptionalDate(value?: string | null, label = "date") {
  if (!value?.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(422, "VALIDATION", `Enter a valid ${label}`);
  }
  return date;
}

function parseOptionalCount(value?: number | string | null) {
  if (value === undefined || value === null || value === "") return null;
  const count = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(count) || count < 1) {
    throw new ApiError(422, "VALIDATION", "Enter a whole number of 1 or more");
  }
  return Math.round(count);
}

function addDays(from: Date, days: number) {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

function expiryFromPlan(defaultDays: number | null, expiresAt?: string) {
  const explicit = parseOptionalDate(expiresAt, "end date");
  if (explicit) return explicit;
  if (!defaultDays) return null;
  return addDays(new Date(), defaultDays);
}

async function resolvePlanPrice(input: {
  amount?: string;
  currencyCode?: string;
}) {
  const money = await getRequestMoney();
  const code = (input.currencyCode || money.defaultCode).toUpperCase();
  const currency = money.currencies.find((item) => item.code === code);
  if (!currency) {
    throw new ApiError(404, "NOT_FOUND", "Currency is not available");
  }
  return {
    amountMinor: parseNonNegativeMajorAmount(input.amount ?? "", currency.decimalPlaces),
    currencyCode: currency.code,
  };
}

async function requireStudentByEmail(email: string) {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new ApiError(404, "NOT_FOUND", "No account matches that email");
  }
  const [student] = await db
    .select({ userId: studentProfiles.userId })
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, user.id))
    .limit(1);
  if (!student) {
    throw new ApiError(422, "VALIDATION", "That account is not a student");
  }
  return { ...user, userId: student.userId };
}

async function requireLearnerMaterial(materialId: string) {
  const [material] = await db
    .select({
      id: teachingMaterials.id,
      category: teachingMaterials.category,
      audience: teachingMaterials.audience,
    })
    .from(teachingMaterials)
    .where(eq(teachingMaterials.id, materialId))
    .limit(1);
  if (!material) {
    throw new ApiError(404, "NOT_FOUND", "Teaching material not found");
  }
  if (material.category === "teacher_guide" || material.audience !== "learners") {
    throw new ApiError(
      422,
      "VALIDATION",
      "Only learner materials can be on a subscription",
    );
  }
  return material;
}

export async function listLibrarySubscriptionDesk(
  actor: ApiActor,
): Promise<LibrarySubscriptionDesk> {
  requireManager(actor);
  const [money, plans, items, seats, materials] = await Promise.all([
    getRequestMoney(),
    db
      .select({
        key: librarySubscriptionPlans.key,
        name: librarySubscriptionPlans.name,
        description: librarySubscriptionPlans.description,
        defaultDays: librarySubscriptionPlans.defaultDays,
        amountMinor: librarySubscriptionPlans.amountMinor,
        currencyCode: librarySubscriptionPlans.currencyCode,
        isEnabled: librarySubscriptionPlans.isEnabled,
        decimalPlaces: currencies.decimalPlaces,
        symbol: currencies.symbol,
      })
      .from(librarySubscriptionPlans)
      .leftJoin(currencies, eq(librarySubscriptionPlans.currencyCode, currencies.code))
      .orderBy(librarySubscriptionPlans.name),
    db
      .select({
        planKey: librarySubscriptionPlanItems.planKey,
        materialId: librarySubscriptionPlanItems.materialId,
        title: teachingMaterials.title,
      })
      .from(librarySubscriptionPlanItems)
      .innerJoin(
        teachingMaterials,
        eq(teachingMaterials.id, librarySubscriptionPlanItems.materialId),
      ),
    db
      .select({
        id: librarySubscriptions.id,
        planKey: librarySubscriptions.planKey,
        studentUserId: librarySubscriptions.studentUserId,
        studentName: users.displayName,
        startsAt: librarySubscriptions.startsAt,
        expiresAt: librarySubscriptions.expiresAt,
        status: librarySubscriptions.status,
      })
      .from(librarySubscriptions)
      .innerJoin(users, eq(users.id, librarySubscriptions.studentUserId))
      .where(eq(librarySubscriptions.status, "active"))
      .orderBy(desc(librarySubscriptions.createdAt)),
    db
      .select({
        id: teachingMaterials.id,
        title: teachingMaterials.title,
      })
      .from(teachingMaterials)
      .where(
        and(
          eq(teachingMaterials.audience, "learners"),
          ne(teachingMaterials.category, "teacher_guide"),
        ),
      )
      .orderBy(teachingMaterials.title)
      .limit(200),
  ]);

  return {
    plans: plans.map((plan) => {
      const planSeats = seats
        .filter((seat) => seat.planKey === plan.key && stillValid(seat.expiresAt, seat.status))
        .map((seat) => ({
          id: seat.id,
          studentUserId: seat.studentUserId,
          studentName: seat.studentName ?? "Student",
          startsAt: seat.startsAt.toISOString(),
          expiresAt: seat.expiresAt?.toISOString() ?? null,
          status: seat.status,
        }));
      const listing =
        plan.currencyCode && plan.symbol != null && plan.decimalPlaces != null
          ? {
              code: plan.currencyCode,
              symbol: plan.symbol,
              decimalPlaces: plan.decimalPlaces,
            }
          : null;
      const price = presentStudentAmount({
        amountMinor: plan.amountMinor,
        listing,
        display: money.currency,
        convert: money.convert,
      });
      return {
        key: plan.key,
        name: plan.name,
        description: plan.description,
        defaultDays: plan.defaultDays,
        monthly: plan.defaultDays === MONTHLY_SUBSCRIPTION_DAYS,
        amountMinor: plan.amountMinor,
        currencyCode: plan.currencyCode,
        amountFormatted: plan.amountMinor > 0 ? price.studentPriceFormatted : null,
        listedPriceFormatted: plan.amountMinor > 0 ? price.listedPriceFormatted : null,
        isEnabled: plan.isEnabled,
        subscriberCount: planSeats.length,
        materials: items
          .filter((item) => item.planKey === plan.key)
          .map((item) => ({ id: item.materialId, title: item.title })),
        subscriptions: planSeats,
      };
    }),
    materials,
    currencies: money.currencies,
    defaultCurrencyCode: money.defaultCode,
  };
}

async function learnerIdsForActor(actor: ApiActor) {
  if (actor.roleKey === "student") return [actor.userId];
  if (actor.roleKey !== "parent") return [];
  const children = await db
    .select({ id: parentChildren.childUserId })
    .from(parentChildren)
    .where(eq(parentChildren.parentUserId, actor.userId));
  return children.map((child) => child.id);
}

export async function listLearnerSubscriptions(
  actor: ApiActor,
): Promise<LearnerSubscriptionView[]> {
  const learnerIds = await learnerIdsForActor(actor);
  if (!learnerIds.length) return [];
  const rows = await db
    .select({
      planKey: librarySubscriptions.planKey,
      planName: librarySubscriptionPlans.name,
      defaultDays: librarySubscriptionPlans.defaultDays,
      startsAt: librarySubscriptions.startsAt,
      expiresAt: librarySubscriptions.expiresAt,
      status: librarySubscriptions.status,
      isEnabled: librarySubscriptionPlans.isEnabled,
      amountMinor: librarySubscriptions.amountMinor,
      currencyCode: librarySubscriptions.currencyCode,
      decimalPlaces: currencies.decimalPlaces,
      symbol: currencies.symbol,
    })
    .from(librarySubscriptions)
    .innerJoin(
      librarySubscriptionPlans,
      eq(librarySubscriptionPlans.key, librarySubscriptions.planKey),
    )
    .leftJoin(currencies, eq(librarySubscriptions.currencyCode, currencies.code))
    .where(inArray(librarySubscriptions.studentUserId, learnerIds))
    .orderBy(librarySubscriptionPlans.name);
  const money = await getRequestMoney();
  return rows
    .filter((row) => row.isEnabled && stillValid(row.expiresAt, row.status))
    .map((row) => {
      const listing =
        row.currencyCode && row.symbol != null && row.decimalPlaces != null
          ? {
              code: row.currencyCode,
              symbol: row.symbol,
              decimalPlaces: row.decimalPlaces,
            }
          : null;
      const price = presentStudentAmount({
        amountMinor: row.amountMinor,
        listing,
        display: money.currency,
        convert: money.convert,
      });
      return {
        planKey: row.planKey,
        planName: row.planName,
        startsAt: row.startsAt.toISOString(),
        expiresAt: row.expiresAt?.toISOString() ?? null,
        monthly: row.defaultDays === MONTHLY_SUBSCRIPTION_DAYS,
        amountFormatted: row.amountMinor > 0 ? price.studentPriceFormatted : null,
        listedPriceFormatted: row.amountMinor > 0 ? price.listedPriceFormatted : null,
      };
    });
}

export async function loadSubscriptionCoverage(materialIds: string[]) {
  if (!materialIds.length) return [];
  return db
    .select({
      planKey: librarySubscriptionPlanItems.planKey,
      materialId: librarySubscriptionPlanItems.materialId,
    })
    .from(librarySubscriptionPlanItems)
    .innerJoin(
      librarySubscriptionPlans,
      eq(librarySubscriptionPlans.key, librarySubscriptionPlanItems.planKey),
    )
    .where(
      and(
        inArray(librarySubscriptionPlanItems.materialId, materialIds),
        eq(librarySubscriptionPlans.isEnabled, true),
      ),
    );
}

export async function createSubscriptionPlan(
  actor: ApiActor,
  input: {
    key: string;
    name: string;
    description?: string;
    defaultDays?: number | string | null;
    amount?: string;
    currencyCode?: string;
  },
  ip: string,
) {
  requireManager(actor);
  const key = slugKey(input.key);
  const name = input.name.trim();
  if (key.length < 2 || name.length < 2) {
    throw new ApiError(422, "VALIDATION", "Enter a plan key and name");
  }
  const price = await resolvePlanPrice(input);
  try {
    await db.insert(librarySubscriptionPlans).values({
      key,
      name,
      description: input.description?.trim() || null,
      defaultDays: parseOptionalCount(input.defaultDays) ?? MONTHLY_SUBSCRIPTION_DAYS,
      amountMinor: price.amountMinor,
      currencyCode: price.currencyCode,
    });
  } catch {
    throw new ApiError(409, "CONFLICT", "That subscription plan already exists");
  }
  await writeAuditLog({
    actor,
    action: "library.subscription_plan_created",
    entityType: "library_subscription_plan",
    entityId: key,
    ipAddress: ip,
    metadata: { name },
  });
  return listLibrarySubscriptionDesk(actor);
}

export async function updateSubscriptionPlan(
  actor: ApiActor,
  input: {
    key: string;
    name?: string;
    description?: string;
    defaultDays?: number | string | null;
    amount?: string;
    currencyCode?: string;
    isEnabled?: boolean;
  },
  ip: string,
) {
  requireManager(actor);
  const key = input.key.trim();
  const [existing] = await db
    .select({ key: librarySubscriptionPlans.key })
    .from(librarySubscriptionPlans)
    .where(eq(librarySubscriptionPlans.key, key))
    .limit(1);
  if (!existing) {
    throw new ApiError(404, "NOT_FOUND", "Subscription plan not found");
  }
  const price =
    input.amount !== undefined || input.currencyCode !== undefined
      ? await resolvePlanPrice(input)
      : null;
  await db
    .update(librarySubscriptionPlans)
    .set({
      ...(input.name?.trim() ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description.trim() || null }
        : {}),
      ...(input.defaultDays !== undefined
        ? { defaultDays: parseOptionalCount(input.defaultDays) }
        : {}),
      ...(price
        ? { amountMinor: price.amountMinor, currencyCode: price.currencyCode }
        : {}),
      ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
    })
    .where(eq(librarySubscriptionPlans.key, key));
  await writeAuditLog({
    actor,
    action: "library.subscription_plan_updated",
    entityType: "library_subscription_plan",
    entityId: key,
    ipAddress: ip,
    metadata: { isEnabled: input.isEnabled },
  });
  return listLibrarySubscriptionDesk(actor);
}

export async function attachSubscriptionMaterial(
  actor: ApiActor,
  input: { planKey: string; materialId: string },
  ip: string,
) {
  requireManager(actor);
  const [plan] = await db
    .select({ key: librarySubscriptionPlans.key })
    .from(librarySubscriptionPlans)
    .where(eq(librarySubscriptionPlans.key, input.planKey.trim()))
    .limit(1);
  if (!plan) {
    throw new ApiError(404, "NOT_FOUND", "Subscription plan not found");
  }
  const material = await requireLearnerMaterial(input.materialId);
  try {
    await db.insert(librarySubscriptionPlanItems).values({
      planKey: plan.key,
      materialId: material.id,
    });
  } catch {
    throw new ApiError(409, "CONFLICT", "That material is already on this plan");
  }
  await db
    .update(teachingMaterials)
    .set({ accessMode: "entitled" })
    .where(eq(teachingMaterials.id, material.id));
  await writeAuditLog({
    actor,
    action: "library.subscription_material_attached",
    entityType: "library_subscription_plan",
    entityId: plan.key,
    ipAddress: ip,
    metadata: { materialId: material.id },
  });
  return listLibrarySubscriptionDesk(actor);
}

export async function detachSubscriptionMaterial(
  actor: ApiActor,
  input: { planKey: string; materialId: string },
  ip: string,
) {
  requireManager(actor);
  const [removed] = await db
    .delete(librarySubscriptionPlanItems)
    .where(
      and(
        eq(librarySubscriptionPlanItems.planKey, input.planKey.trim()),
        eq(librarySubscriptionPlanItems.materialId, input.materialId),
      ),
    )
    .returning({ materialId: librarySubscriptionPlanItems.materialId });
  if (!removed) {
    throw new ApiError(404, "NOT_FOUND", "That material is not on this plan");
  }
  await writeAuditLog({
    actor,
    action: "library.subscription_material_detached",
    entityType: "library_subscription_plan",
    entityId: input.planKey.trim(),
    ipAddress: ip,
    metadata: { materialId: input.materialId },
  });
  return listLibrarySubscriptionDesk(actor);
}

export async function assignLibrarySubscriptionSeat(
  actor: ApiActor,
  input: {
    email: string;
    planKey: string;
    startsAt?: string;
    expiresAt?: string;
  },
  ip: string,
) {
  requireManager(actor);
  const student = await requireStudentByEmail(input.email);
  const [plan] = await db
    .select({
      key: librarySubscriptionPlans.key,
      defaultDays: librarySubscriptionPlans.defaultDays,
      isEnabled: librarySubscriptionPlans.isEnabled,
      amountMinor: librarySubscriptionPlans.amountMinor,
      currencyCode: librarySubscriptionPlans.currencyCode,
    })
    .from(librarySubscriptionPlans)
    .where(eq(librarySubscriptionPlans.key, input.planKey.trim()))
    .limit(1);
  if (!plan) {
    throw new ApiError(404, "NOT_FOUND", "Subscription plan not found");
  }
  if (!plan.isEnabled) {
    throw new ApiError(422, "VALIDATION", "That subscription plan is disabled");
  }
  const startsAt = parseOptionalDate(input.startsAt, "start date") ?? new Date();
  const expiresAt = expiryFromPlan(plan.defaultDays, input.expiresAt);
  if (expiresAt && expiresAt.getTime() <= startsAt.getTime()) {
    throw new ApiError(422, "VALIDATION", "The subscription must end after it starts");
  }

  const existing = await db
    .select({
      id: librarySubscriptions.id,
      expiresAt: librarySubscriptions.expiresAt,
      status: librarySubscriptions.status,
    })
    .from(librarySubscriptions)
    .where(
      and(
        eq(librarySubscriptions.planKey, plan.key),
        eq(librarySubscriptions.studentUserId, student.userId),
        eq(librarySubscriptions.status, "active"),
      ),
    );
  if (existing.some((row) => stillValid(row.expiresAt, row.status))) {
    throw new ApiError(
      409,
      "CONFLICT",
      "That student already has this subscription",
    );
  }

  const [created] = await db
    .insert(librarySubscriptions)
    .values({
      studentUserId: student.userId,
      planKey: plan.key,
      startsAt,
      expiresAt,
      amountMinor: plan.amountMinor,
      currencyCode: plan.currencyCode,
      grantedByUserId: actor.userId,
    })
    .returning({ id: librarySubscriptions.id });
  await writeAuditLog({
    actor,
    action: "library.subscription_assigned",
    entityType: "library_subscription",
    entityId: created?.id ?? student.userId,
    ipAddress: ip,
    metadata: {
      planKey: plan.key,
      studentUserId: student.userId,
      expiresAt: expiresAt?.toISOString() ?? null,
    },
  });
  return listLibrarySubscriptionDesk(actor);
}

export async function extendLibrarySubscription(
  actor: ApiActor,
  input: {
    subscriptionId: string;
    days?: number | string | null;
    expiresAt?: string;
  },
  ip: string,
) {
  requireManager(actor);
  const [row] = await db
    .select({
      id: librarySubscriptions.id,
      planKey: librarySubscriptions.planKey,
      expiresAt: librarySubscriptions.expiresAt,
      status: librarySubscriptions.status,
    })
    .from(librarySubscriptions)
    .where(eq(librarySubscriptions.id, input.subscriptionId))
    .limit(1);
  if (!row || row.status === "ended") {
    throw new ApiError(404, "NOT_FOUND", "Subscription not found");
  }
  const explicitEnd = parseOptionalDate(input.expiresAt, "end date");
  const days = parseOptionalCount(input.days);
  const base =
    row.expiresAt && row.expiresAt.getTime() > Date.now()
      ? row.expiresAt
      : new Date();
  const expiresAt = explicitEnd ?? (days ? addDays(base, days) : null);
  if (!expiresAt) {
    throw new ApiError(422, "VALIDATION", "Set extra days or a new end date");
  }
  if (expiresAt.getTime() <= Date.now()) {
    throw new ApiError(422, "VALIDATION", "The new end date must be in the future");
  }
  await db
    .update(librarySubscriptions)
    .set({ expiresAt, status: "active" })
    .where(eq(librarySubscriptions.id, row.id));
  await writeAuditLog({
    actor,
    action: "library.subscription_extended",
    entityType: "library_subscription",
    entityId: row.id,
    ipAddress: ip,
    metadata: { planKey: row.planKey, expiresAt: expiresAt.toISOString() },
  });
  return listLibrarySubscriptionDesk(actor);
}

export async function endLibrarySubscription(
  actor: ApiActor,
  input: { subscriptionId: string },
  ip: string,
) {
  requireManager(actor);
  const [ended] = await db
    .update(librarySubscriptions)
    .set({ status: "ended" })
    .where(
      and(
        eq(librarySubscriptions.id, input.subscriptionId),
        eq(librarySubscriptions.status, "active"),
      ),
    )
    .returning({
      id: librarySubscriptions.id,
      planKey: librarySubscriptions.planKey,
    });
  if (!ended) {
    throw new ApiError(404, "NOT_FOUND", "Subscription not found");
  }
  await writeAuditLog({
    actor,
    action: "library.subscription_ended",
    entityType: "library_subscription",
    entityId: ended.id,
    ipAddress: ip,
    metadata: { planKey: ended.planKey },
  });
  return listLibrarySubscriptionDesk(actor);
}
