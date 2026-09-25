import { brandColors, type BrandProfile } from "@/lib/brand";

export const CLASSROOM_BRAND_SETTING_KEY = "brand.classroom";

export const classroomWatermarkPlacements = ["bar", "corner", "both"] as const;

export type ClassroomWatermarkPlacement =
  (typeof classroomWatermarkPlacements)[number];

export type ClassroomOverlay = {
  showMark: boolean;
  showName: boolean;
  showNameAr: boolean;
  showTagline: boolean;
  watermark: ClassroomWatermarkPlacement;
  caption: string;
  primaryColor: string;
  accentColor: string;
};

const HEX = /^#([0-9a-fA-F]{6})$/;
const LEGACY_PRIMARY = "#0e3b32";
const LEGACY_ACCENT = "#c4a35a";

export const defaultClassroomOverlay: ClassroomOverlay = {
  showMark: true,
  showName: true,
  showNameAr: true,
  showTagline: true,
  watermark: "both",
  caption: "",
  primaryColor: brandColors.primary,
  accentColor: brandColors.accent,
};

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function asHex(value: unknown, fallback: string) {
  return typeof value === "string" && HEX.test(value) ? value : fallback;
}

function asPlacement(value: unknown): ClassroomWatermarkPlacement {
  return classroomWatermarkPlacements.includes(value as ClassroomWatermarkPlacement)
    ? (value as ClassroomWatermarkPlacement)
    : defaultClassroomOverlay.watermark;
}

export function parseClassroomOverlay(
  value: unknown,
  brand?: BrandProfile,
): ClassroomOverlay {
  const record =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const fallbackPrimary = brand?.colors.primary ?? defaultClassroomOverlay.primaryColor;
  const fallbackAccent = brand?.colors.accent ?? defaultClassroomOverlay.accentColor;
  const primaryColor = asHex(record.primaryColor, fallbackPrimary);
  const accentColor = asHex(record.accentColor, fallbackAccent);
  return {
    showMark: asBoolean(record.showMark, defaultClassroomOverlay.showMark),
    showName: asBoolean(record.showName, defaultClassroomOverlay.showName),
    showNameAr: asBoolean(record.showNameAr, defaultClassroomOverlay.showNameAr),
    showTagline: asBoolean(record.showTagline, defaultClassroomOverlay.showTagline),
    watermark: asPlacement(record.watermark),
    caption:
      typeof record.caption === "string"
        ? record.caption.trim().slice(0, 80)
        : defaultClassroomOverlay.caption,
    primaryColor:
      primaryColor.toLowerCase() === LEGACY_PRIMARY ? fallbackPrimary : primaryColor,
    accentColor:
      accentColor.toLowerCase() === LEGACY_ACCENT ? fallbackAccent : accentColor,
  };
}

export function overlayShowsBar(overlay: ClassroomOverlay) {
  return overlay.watermark === "bar" || overlay.watermark === "both";
}

export function overlayShowsCorner(overlay: ClassroomOverlay) {
  return overlay.watermark === "corner" || overlay.watermark === "both";
}
