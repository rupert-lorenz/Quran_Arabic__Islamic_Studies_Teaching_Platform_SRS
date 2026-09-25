import { createHash } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { teacherAgreementVersions, teacherAgreements } from "@/db/schema";
import { ApiError } from "@/server/api/errors";

export const TEACHER_AGREEMENT_VERSION = "2026-09-1";
export const TEACHER_AGREEMENT_TITLE = "Teacher platform agreement";

export const teacherAgreementClauses = [
  "I will teach only through this platform and will not share personal contact details with students or parents.",
  "I confirm that identity and qualification documents I submit are my own and are accurate.",
  "I will follow safeguarding rules, including never being alone in an unrecorded lesson with a child.",
  "I understand the platform may review recordings, documents, and lesson conduct.",
  "I accept that approval can be withdrawn if these terms are broken.",
] as const;

export type AgreementRecord = {
  id: string;
  version: string;
  title: string;
  clauses: string[];
  signatureName: string;
  acceptedAt: Date;
  ipAddress: string | null;
  userAgent?: string | null;
  contentHash: string | null;
  valid: boolean;
  current: boolean;
};

export function serializeClauses(clauses: readonly string[]) {
  return JSON.stringify([...clauses]);
}

export function parseClauses(value: string | null | undefined): string[] {
  if (!value) {
    return [...teacherAgreementClauses];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return parsed;
    }
  } catch {
    // Fall through to the current published clauses.
  }
  return [...teacherAgreementClauses];
}

export function agreementContentHash(input: {
  version: string;
  title: string;
  clauses: readonly string[];
  teacherUserId: string;
  signatureName: string;
  acceptedAt: Date;
}) {
  const canonical = [
    "teacher-agreement-v1",
    input.version,
    input.title,
    ...input.clauses,
    input.teacherUserId,
    input.signatureName.trim(),
    input.acceptedAt.toISOString(),
  ].join("\n");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export async function ensureCurrentAgreementVersion() {
  const [current] = await db
    .select()
    .from(teacherAgreementVersions)
    .where(eq(teacherAgreementVersions.isCurrent, true))
    .limit(1);

  if (current) {
    return {
      version: current.version,
      title: current.title,
      clauses: parseClauses(current.clauses),
    };
  }

  await db
    .insert(teacherAgreementVersions)
    .values({
      version: TEACHER_AGREEMENT_VERSION,
      title: TEACHER_AGREEMENT_TITLE,
      clauses: serializeClauses(teacherAgreementClauses),
      isCurrent: true,
    })
    .onConflictDoNothing({ target: teacherAgreementVersions.version });

  await db
    .update(teacherAgreementVersions)
    .set({ isCurrent: true })
    .where(eq(teacherAgreementVersions.version, TEACHER_AGREEMENT_VERSION));

  return {
    version: TEACHER_AGREEMENT_VERSION,
    title: TEACHER_AGREEMENT_TITLE,
    clauses: [...teacherAgreementClauses],
  };
}

export function publicAgreementRecord(
  record: {
    id: string;
    teacherUserId: string;
    version: string;
    title: string | null;
    clauseSnapshot: string | null;
    contentHash: string | null;
    signatureName: string;
    ipAddress: string | null;
    userAgent?: string | null;
    acceptedAt: Date;
  },
  currentVersion: string,
  includeStaffFields = false,
): AgreementRecord {
  const title = record.title || TEACHER_AGREEMENT_TITLE;
  const clauses = parseClauses(record.clauseSnapshot);
  const valid = record.contentHash
    ? record.contentHash ===
      agreementContentHash({
        version: record.version,
        title,
        clauses,
        teacherUserId: record.teacherUserId,
        signatureName: record.signatureName,
        acceptedAt: record.acceptedAt,
      })
    : false;

  return {
    id: record.id,
    version: record.version,
    title,
    clauses,
    signatureName: record.signatureName,
    acceptedAt: record.acceptedAt,
    ipAddress: record.ipAddress,
    contentHash: record.contentHash,
    valid,
    current: record.version === currentVersion,
    ...(includeStaffFields ? { userAgent: record.userAgent ?? null } : {}),
  };
}

export async function listTeacherAgreements(
  teacherUserId: string,
  currentVersion: string,
  includeStaffFields = false,
) {
  const rows = await db
    .select()
    .from(teacherAgreements)
    .where(eq(teacherAgreements.teacherUserId, teacherUserId))
    .orderBy(desc(teacherAgreements.acceptedAt));

  const current = await ensureCurrentAgreementVersion();
  const complete = [];
  for (const row of rows) {
    if (row.clauseSnapshot && row.contentHash) {
      complete.push(row);
      continue;
    }
    const clauses = parseClauses(row.clauseSnapshot);
    const title = row.title || current.title;
    const contentHash = agreementContentHash({
      version: row.version,
      title,
      clauses,
      teacherUserId: row.teacherUserId,
      signatureName: row.signatureName,
      acceptedAt: row.acceptedAt,
    });
    const [updated] = await db
      .update(teacherAgreements)
      .set({
        title,
        clauseSnapshot: serializeClauses(clauses),
        contentHash,
      })
      .where(
        and(
          eq(teacherAgreements.teacherUserId, row.teacherUserId),
          eq(teacherAgreements.version, row.version),
        ),
      )
      .returning();
    complete.push(updated ?? { ...row, title, clauseSnapshot: serializeClauses(clauses), contentHash });
  }

  return complete.map((row) =>
    publicAgreementRecord(row, currentVersion, includeStaffFields),
  );
}

export async function listTeacherAgreementsForUsers(
  teacherUserIds: string[],
  includeStaffFields = false,
) {
  const current = await ensureCurrentAgreementVersion();
  if (teacherUserIds.length === 0) {
    return { current, byUser: new Map<string, AgreementRecord[]>() };
  }

  const grouped = new Map<string, AgreementRecord[]>();
  for (const userId of teacherUserIds) {
    grouped.set(
      userId,
      await listTeacherAgreements(userId, current.version, includeStaffFields),
    );
  }
  return { current, byUser: grouped };
}

export async function getCurrentAgreementSignature(teacherUserId: string) {
  const current = await ensureCurrentAgreementVersion();
  const records = await listTeacherAgreements(
    teacherUserId,
    current.version,
  );
  return {
    current,
    records,
    agreement: records.find((item) => item.current) ?? null,
  };
}

export async function publishAgreementVersion(input: {
  version: string;
  title: string;
  clauses: string[];
  publishedByUserId: string;
}) {
  if (input.version === TEACHER_AGREEMENT_VERSION && input.clauses.length === 0) {
    throw new ApiError(422, "VALIDATION", "Add at least one clause");
  }

  await ensureCurrentAgreementVersion();

  const [existing] = await db
    .select()
    .from(teacherAgreementVersions)
    .where(eq(teacherAgreementVersions.version, input.version))
    .limit(1);
  if (existing) {
    const [signed] = await db
      .select({ id: teacherAgreements.id })
      .from(teacherAgreements)
      .where(eq(teacherAgreements.version, input.version))
      .limit(1);
    if (
      signed &&
      (existing.title !== input.title ||
        existing.clauses !== serializeClauses(input.clauses))
    ) {
      throw new ApiError(
        409,
        "LOCKED",
        "This version already has signatures. Publish a new version number.",
      );
    }
  }

  await db
    .update(teacherAgreementVersions)
    .set({ isCurrent: false })
    .where(eq(teacherAgreementVersions.isCurrent, true));

  await db
    .insert(teacherAgreementVersions)
    .values({
      version: input.version,
      title: input.title,
      clauses: serializeClauses(input.clauses),
      isCurrent: true,
      publishedByUserId: input.publishedByUserId,
    })
    .onConflictDoUpdate({
      target: teacherAgreementVersions.version,
      set: {
        title: input.title,
        clauses: serializeClauses(input.clauses),
        isCurrent: true,
        publishedByUserId: input.publishedByUserId,
        publishedAt: new Date(),
      },
    });

  return ensureCurrentAgreementVersion();
}
