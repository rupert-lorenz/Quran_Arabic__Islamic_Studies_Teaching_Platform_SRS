import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import {
  createTeachingMaterial,
  listTeachingLibrary,
} from "@/server/lms/library";
import {
  libraryAccessModeSchema,
  listTeachingLibrarySchema,
  teachingMaterialAudienceSchema,
  teachingMaterialCategorySchema,
  teachingMaterialStatusSchema,
} from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: listTeachingLibrarySchema,
  },
  async ({ actor, input }) => listTeachingLibrary(actor!, input),
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor, request, ip }) => {
    const form = await request.formData();
    const uploaded = form.get("file");
    if (!(uploaded instanceof File)) {
      throw new ApiError(400, "VALIDATION", "Choose a file to add");
    }
    const category = teachingMaterialCategorySchema.parse(
      String(form.get("category") ?? ""),
    );
    const statusValue = String(form.get("status") ?? "draft");
    const audienceValue = String(form.get("audience") ?? "");
    const accessModeValue = String(form.get("accessMode") ?? "");
    const downloadsRestricted =
      form.get("downloadsRestricted") === "true" ||
      form.get("downloadsRestricted") === "on";
    return createTeachingMaterial(
      actor!,
      {
        title: String(form.get("title") ?? ""),
        description: String(form.get("description") ?? ""),
        category,
        subjectSlug: String(form.get("subjectSlug") ?? ""),
        audience: audienceValue
          ? teachingMaterialAudienceSchema.parse(audienceValue)
          : undefined,
        accessMode: accessModeValue
          ? libraryAccessModeSchema.parse(accessModeValue)
          : undefined,
        downloadsRestricted,
        status:
          statusValue === "published"
            ? teachingMaterialStatusSchema.parse(statusValue)
            : "draft",
        name: uploaded.name,
        mimeType: uploaded.type,
        bytes: Buffer.from(await uploaded.arrayBuffer()),
      },
      ip,
    );
  },
);
