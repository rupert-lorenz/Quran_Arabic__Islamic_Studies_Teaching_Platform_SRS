export type BrandProfile = {
  name: string;
  shortName: string;
  legalName: string;
  nameAr: string;
  tagline: string;
  taglineAr: string;
  description: string;
  supportEmail: string;
  colors: {
    primary: string;
    soft: string;
    accent: string;
    background: string;
    surface: string;
  };
};

export const brandColors = {
  primary: "#294634",
  soft: "#3B563F",
  accent: "#CB9F64",
  background: "#F3F4F2",
  surface: "#FFFFFF",
} as const;

export const defaultBrand: BrandProfile = {
  name: "Al Haramain Schools",
  shortName: "AH",
  legalName: "Al Haramain Schools",
  nameAr: "مدارس الحرمين",
  tagline: "Qur'an, Arabic & Islamic Studies",
  taglineAr: "القرآن والعربية والدراسات الإسلامية",
  description:
    "A premium, child-friendly marketplace for Qur'an, Arabic, and Islamic Studies — with live lessons, parent oversight, and trusted teachers.",
  supportEmail: "support@localhost",
  colors: brandColors,
};

const LEGACY_BRAND_NAMES = new Set(["Teaching Platform", "منصة التعليم"]);

export function isLegacyBrandName(value?: string) {
  return !value || LEGACY_BRAND_NAMES.has(value);
}

export function isBrandProfile(value: unknown): value is BrandProfile {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.name === "string" && typeof record.tagline === "string";
}

export function localizeBrand(
  brand: BrandProfile,
  locale: string,
  description?: string,
): BrandProfile {
  const arabic = locale === "ar" || locale.startsWith("ar-");
  return {
    ...brand,
    name: arabic && brand.nameAr ? brand.nameAr : brand.name,
    tagline: arabic && brand.taglineAr ? brand.taglineAr : brand.tagline,
    description: description ?? brand.description,
  };
}
