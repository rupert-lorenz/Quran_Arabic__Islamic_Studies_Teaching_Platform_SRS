"use client";

import { ButtonLink } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";

export function ClassroomJoinButton({
  href,
  joinable,
  className = "",
}: {
  href?: string | null;
  joinable?: boolean;
  className?: string;
}) {
  const t = useT();
  if (!href || !joinable) {
    return null;
  }
  return (
    <ButtonLink href={href} className={className}>
      {t("classroom.join")}
    </ButtonLink>
  );
}
