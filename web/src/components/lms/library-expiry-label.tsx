"use client";

import { useT } from "@/components/i18n/i18n-provider";
import {
  libraryExpiryDaysLeft,
  libraryExpiryStatus,
} from "@/lib/library-materials";

export function LibraryExpiryLabel({
  expiresAt,
}: {
  expiresAt?: string | null;
}) {
  const t = useT();
  const status = libraryExpiryStatus(expiresAt);
  if (status === "open") return <>{t("library.expiry.open")}</>;
  if (status === "expired" || !expiresAt) return <>{t("library.expiry.ended")}</>;
  const days = libraryExpiryDaysLeft(expiresAt);
  return (
    <>
      {t("library.access.grant_expires")} {expiresAt.slice(0, 10)}
      {days !== null ? ` · ${t("library.expiry.days_left", { count: days })}` : ""}
    </>
  );
}
