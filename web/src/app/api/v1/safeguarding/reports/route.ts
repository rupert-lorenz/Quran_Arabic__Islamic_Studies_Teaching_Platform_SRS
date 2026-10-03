import { apiRoute } from "@/server/api/handler";
import {
  listMySafeguardingReports,
  submitSafeguardingReport,
  submitSafeguardingReportSchema,
} from "@/server/safeguarding/reports";

export const runtime = "nodejs";

export const GET = apiRoute(
  { auth: "session", rateLimit: "sensitive" },
  async ({ actor }) => listMySafeguardingReports(actor!),
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: submitSafeguardingReportSchema,
  },
  async ({ actor, input, ip }) => submitSafeguardingReport(actor!, input, ip),
);
