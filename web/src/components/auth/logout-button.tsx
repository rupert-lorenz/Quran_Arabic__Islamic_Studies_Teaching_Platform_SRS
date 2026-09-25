"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/api";

export function LogoutButton({
  className = "",
  size = "md",
  tone = "default",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  tone?: "default" | "inverse";
}) {
  const t = useT();
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="secondary"
      size={size}
      tone={tone}
      className={className}
      onClick={async () => {
        await postJson("/api/v1/auth/logout", {});
        router.push("/");
        router.refresh();
      }}
    >
      {t("nav.logout")}
    </Button>
  );
}
