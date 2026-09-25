export const SEO_TITLE_MAX = 80;
export const SEO_DESCRIPTION_MAX = 180;

export type SiteSeo = {
  defaultTitle: string;
  defaultDescription: string;
  robotsIndex: boolean;
};

export const defaultSiteSeo: SiteSeo = {
  defaultTitle: "",
  defaultDescription: "",
  robotsIndex: true,
};

export function parseSiteSeo(value: unknown): SiteSeo {
  if (!value || typeof value !== "object") {
    return { ...defaultSiteSeo };
  }
  const record = value as Record<string, unknown>;
  return {
    defaultTitle:
      typeof record.defaultTitle === "string" ? record.defaultTitle.trim() : "",
    defaultDescription:
      typeof record.defaultDescription === "string"
        ? record.defaultDescription.trim()
        : "",
    robotsIndex: record.robotsIndex !== false,
  };
}

export const AUTH_DISALLOW_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/setup",
] as const;

export const PRIVATE_DISALLOW_PATHS = [
  "/staff/",
  "/account/",
  "/api/",
  "/learn/",
  "/family/",
  "/teach/home",
  "/teach/onboarding",
  "/teach/status",
  "/teach/profile",
  "/teach/agreement",
  "/teach/video",
  "/teach/availability",
  "/teach/bookings",
] as const;
