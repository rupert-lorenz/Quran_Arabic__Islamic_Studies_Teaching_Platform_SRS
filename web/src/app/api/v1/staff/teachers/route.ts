import { apiRoute } from "@/server/api/handler";
import { listTeacherApplications } from "@/server/teacher/applications";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    permission: ["teachers.approve", "teachers.documents.review"],
    rateLimit: "sensitive",
  },
  async () => ({ applications: await listTeacherApplications() }),
);
