import { eq } from "drizzle-orm";
import { db } from "@/db";
import { platformSettings } from "@/db/schema";
import {
  defaultBrand,
  isBrandProfile,
  isLegacyBrandName,
  type BrandProfile,
} from "@/lib/brand";
import { getConfig } from "@/server/config";

let cached: { brand: BrandProfile; expiresAt: number } | undefined;

function mergeBrand(stored?: BrandProfile): BrandProfile {
  const config = getConfig();
  let supportEmail = stored?.supportEmail ?? defaultBrand.supportEmail;

  try {
    const host = new URL(config.APP_URL).hostname;
    if (supportEmail.endsWith("localhost") && host !== "localhost") {
      supportEmail = `support@${host}`;
    }
  } catch {
    // keep fallback
  }

  const storedName = isLegacyBrandName(stored?.name)
    ? defaultBrand.name
    : stored?.name ?? config.APP_NAME ?? defaultBrand.name;
  const storedLegal = isLegacyBrandName(stored?.legalName ?? stored?.name)
    ? defaultBrand.legalName
    : (stored?.legalName ?? storedName);
  const storedShort =
    stored?.shortName && stored.shortName !== "TP"
      ? stored.shortName
      : defaultBrand.shortName;
  const storedNameAr =
    stored?.nameAr && stored.nameAr !== "منصة التعليم"
      ? stored.nameAr
      : defaultBrand.nameAr;

  return {
    ...defaultBrand,
    ...stored,
    name: storedName,
    shortName: storedShort,
    legalName: storedLegal,
    nameAr: storedNameAr,
    colors: defaultBrand.colors,
    supportEmail,
  };
}

export async function getBrand(): Promise<BrandProfile> {
  if (cached && cached.expiresAt > Date.now()) {
    return cached.brand;
  }

  try {
    const [row] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, "brand.profile"))
      .limit(1);

    const stored = isBrandProfile(row?.value) ? row.value : undefined;
    const brand = mergeBrand(stored);
    cached = { brand, expiresAt: Date.now() + 30_000 };
    return brand;
  } catch {
    return mergeBrand();
  }
}

export function resetBrandCache() {
  cached = undefined;
}
