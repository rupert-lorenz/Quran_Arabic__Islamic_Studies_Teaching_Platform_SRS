import { z } from "zod";
import { CRM_REPORTS, EXPORT_FORMATS } from "@/lib/crm";
import { apiRoute } from "@/server/api/handler";
import { buildCrmReport, renderCrmReport } from "@/server/crm/reports";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: z.object({
      report: z.enum(CRM_REPORTS),
      format: z.enum(EXPORT_FORMATS),
    }),
  },
  async ({ actor, input }) => {
    const table = await buildCrmReport(actor!, input.report);
    const file = renderCrmReport(table, input.format);
    return new Response(file.body, {
      headers: {
        "Content-Type": file.type,
        "Content-Disposition": `attachment; filename="${file.filename.replaceAll('"', "")}"`,
      },
    });
  },
);
