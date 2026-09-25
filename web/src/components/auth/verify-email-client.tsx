"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/components/i18n/i18n-provider";
import { postJson } from "@/lib/api";
import { signedInPath } from "@/lib/auth-home";

export function VerifyEmailClient({ token }: { token: string }) {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("This verification link is missing.");
      return;
    }

    postJson<{
      user?: { roleKey?: string; onboardingRequired?: boolean };
      twoFactor?: { required: boolean };
    }>("/api/v1/auth/verify-email", { token })
      .then((result) => {
        router.replace(
          result.twoFactor?.required
            ? "/login/two-factor"
            : signedInPath({
                roleKey: result.user?.roleKey ?? "parent",
                onboardingRequired: result.user?.onboardingRequired,
              }),
        );
        router.refresh();
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not verify email");
      });
  }, [token, router]);

  if (error) {
    return <p className="text-sm font-semibold text-brand">{error}</p>;
  }

  return <p className="text-sm font-semibold text-muted">{t("auth.verify_confirming")}</p>;
}
