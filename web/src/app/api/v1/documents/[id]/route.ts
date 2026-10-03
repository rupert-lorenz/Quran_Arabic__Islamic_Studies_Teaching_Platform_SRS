import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { readStudentDocument } from "@/server/infrastructure/documents";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "session", rateLimit: "sensitive" },
  async ({ actor, params }) => {
    if (!params.id) {
      throw new ApiError(400, "VALIDATION", "Document id is required");
    }
    const file = await readStudentDocument(actor!, params.id);
    const name = (file.originalName || "document").replace(/[^A-Za-z0-9._-]/g, "_");
    return new Response(new Uint8Array(file.content), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "private, no-store",
      },
    });
  },
);
