import { apiRoute } from "@/server/api/handler";
import { getBrand } from "@/server/brand";

export const runtime = "nodejs";

export const GET = apiRoute({ auth: "public", rateLimit: "public" }, async () => {
  return getBrand();
});
