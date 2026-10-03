import { apiRoute } from "@/server/api/handler";
import { ApiError } from "@/server/api/errors";
import { readTicketAttachment } from "@/server/crm/records";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "session", rateLimit: "sensitive" },
  async ({ actor, params }) => {
    if (!params.id || !params.attachmentId) {
      throw new ApiError(400, "VALIDATION", "Attachment id is required");
    }
    const file = await readTicketAttachment(actor!, params.id, params.attachmentId);
    const name = file.originalName.replace(/[^A-Za-z0-9._-]/g, "_");
    return new Response(new Uint8Array(file.content), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  },
);
