import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { teachingMaterials } from "@/db/schema";
import { hasAnyPermission } from "@/lib/rbac";
import type { TeachingMaterialAudience, TeachingMaterialCategory } from "@/lib/library-materials";
import type { ApiActor } from "@/server/api/auth";
import { writeAuditLog } from "@/server/api/audit";
import { ApiError } from "@/server/api/errors";

export type LibraryDownloadRow = {
  id: string;
  title: string;
  category: TeachingMaterialCategory;
  audience: TeachingMaterialAudience;
  downloadsRestricted: boolean;
};

export type LibraryDownloadDesk = {
  materials: LibraryDownloadRow[];
};

function requireManager(actor: ApiActor) {
  if (!hasAnyPermission(actor, "academic.curriculum")) {
    throw new ApiError(403, "FORBIDDEN", "You cannot manage library downloads");
  }
}

export async function listLibraryDownloadDesk(
  actor: ApiActor,
): Promise<LibraryDownloadDesk> {
  requireManager(actor);
  const materials = await db
    .select({
      id: teachingMaterials.id,
      title: teachingMaterials.title,
      category: teachingMaterials.category,
      audience: teachingMaterials.audience,
      downloadsRestricted: teachingMaterials.downloadsRestricted,
    })
    .from(teachingMaterials)
    .orderBy(asc(teachingMaterials.sortOrder), desc(teachingMaterials.createdAt))
    .limit(200);
  return { materials };
}

export async function setLibraryDownloadRestriction(
  actor: ApiActor,
  input: { materialId: string; downloadsRestricted: boolean },
  ip: string,
) {
  requireManager(actor);
  const [updated] = await db
    .update(teachingMaterials)
    .set({ downloadsRestricted: input.downloadsRestricted })
    .where(eq(teachingMaterials.id, input.materialId))
    .returning({ id: teachingMaterials.id });
  if (!updated) {
    throw new ApiError(404, "NOT_FOUND", "Teaching material not found");
  }
  await writeAuditLog({
    actor,
    action: "library.download_restriction_set",
    entityType: "teaching_material",
    entityId: updated.id,
    ipAddress: ip,
    metadata: { downloadsRestricted: input.downloadsRestricted },
  });
  return listLibraryDownloadDesk(actor);
}
