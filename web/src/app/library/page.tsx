import { redirect } from "next/navigation";
import { getAccessContext, signedInHome } from "@/server/rbac/guard";

export const metadata = {
  title: "Teaching library",
};

export default async function LibraryHubPage() {
  const access = await getAccessContext();
  if (!access) {
    redirect("/login");
  }
  if (access.user.roleKey === "student") {
    redirect("/learn/library");
  }
  if (access.user.roleKey === "parent") {
    redirect("/family/library");
  }
  if (access.user.roleKey === "teacher") {
    redirect("/teach/library");
  }
  if (access.isStaff) {
    redirect("/staff/academic");
  }
  redirect(signedInHome(access));
}
