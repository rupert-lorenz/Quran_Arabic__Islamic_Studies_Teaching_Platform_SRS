import { isStaffRole } from "@/lib/rbac";

export function signedInPath(user: {
  roleKey: string;
  onboardingRequired?: boolean;
}) {
  if (isStaffRole(user.roleKey)) {
    return "/staff";
  }
  if (user.roleKey === "teacher") {
    return "/teach/home";
  }
  if (user.roleKey === "student") {
    return "/learn";
  }
  if (user.roleKey === "parent") {
    return "/family";
  }
  return "/account";
}
