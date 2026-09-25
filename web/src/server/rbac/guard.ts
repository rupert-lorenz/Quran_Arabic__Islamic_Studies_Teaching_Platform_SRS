import { redirect } from "next/navigation";
import { getServerUser } from "@/server/auth/session";
import { isTotpEnabled } from "@/server/auth/two-factor-status";
import { hasAnyPermission, isStaffRole } from "@/lib/rbac";
import { getTeacherVerificationStatus, teacherNeedsOnboarding } from "@/server/teacher/onboarding";
import { getEffectivePermissions } from "./effective";

export function signedInHome(access: {
  isStaff: boolean;
  twoFactorPending: boolean;
  teacherOnboardingRequired?: boolean;
  roleKey?: string;
}) {
  if (access.twoFactorPending) {
    return "/account/security";
  }
  if (access.isStaff) {
    return "/staff";
  }
  if (access.roleKey === "teacher" || access.teacherOnboardingRequired) {
    return "/teach/home";
  }
  if (access.roleKey === "student") {
    return "/learn";
  }
  if (access.roleKey === "parent") {
    return "/family";
  }
  return "/account";
}

export async function getAccessContext() {
  const user = await getServerUser();
  if (!user) {
    return null;
  }

  const permissions = await getEffectivePermissions(user.id, user.roleKey);
  const twoFactorPending =
    isStaffRole(user.roleKey) && !(await isTotpEnabled(user.id));
  const teacherVerification =
    user.roleKey === "teacher"
      ? await getTeacherVerificationStatus(user.id)
      : null;

  return {
    user,
    roleKey: user.roleKey,
    permissions,
    isStaff: isStaffRole(user.roleKey) || permissions.length > 0,
    twoFactorPending,
    twoFactorEnabled: isStaffRole(user.roleKey) && !twoFactorPending,
    teacherVerification,
    teacherOnboardingRequired:
      user.roleKey === "teacher" &&
      teacherNeedsOnboarding(teacherVerification ?? "application_started"),
  };
}

export async function requireTeacherOnboarding() {
  const access = await getAccessContext();
  if (!access) {
    redirect("/login");
  }
  if (access.user.roleKey !== "teacher") {
    redirect(signedInHome(access));
  }
  if (!access.teacherOnboardingRequired) {
    redirect("/teach/home");
  }
  return access;
}

export async function requireParent() {
  const access = await getAccessContext();
  if (!access) {
    redirect("/login");
  }
  if (access.user.roleKey !== "parent") {
    redirect(signedInHome(access));
  }
  return access;
}

export async function requireStudent() {
  const access = await getAccessContext();
  if (!access) {
    redirect("/login");
  }
  if (access.user.roleKey !== "student") {
    redirect(signedInHome(access));
  }
  return access;
}

export async function requireTeacher() {
  const access = await getAccessContext();
  if (!access) {
    redirect("/login");
  }
  if (access.user.roleKey !== "teacher") {
    redirect(signedInHome(access));
  }
  return access;
}

export async function requireApprovedTeacher() {
  const access = await getAccessContext();
  if (!access) {
    redirect("/login");
  }
  if (access.user.roleKey !== "teacher") {
    redirect(signedInHome(access));
  }
  if (access.teacherOnboardingRequired) {
    redirect("/teach/onboarding");
  }
  return access;
}

export async function requireStaffPage(permission?: string | string[]) {
  const access = await getAccessContext();
  if (!access) {
    redirect("/login");
  }

  if (access.twoFactorPending) {
    redirect("/account/security");
  }

  if (!access.isStaff) {
    redirect(signedInHome(access));
  }

  if (permission && !hasAnyPermission(access, permission)) {
    redirect("/staff");
  }

  return access;
}
