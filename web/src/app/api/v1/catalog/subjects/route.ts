import { apiRoute } from "@/server/api/handler";
import { listTranslatedSubjects } from "@/server/i18n/locale";

export const runtime = "nodejs";

export const GET = apiRoute({ auth: "public", rateLimit: "public" }, async () => {
  const rows = await listTranslatedSubjects();
  return {
    subjects: rows.map((item) => ({
      slug: item.slug,
      name: item.name,
      description: item.description,
    })),
  };
});
