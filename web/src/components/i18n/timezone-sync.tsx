"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { postJson } from "@/lib/api";
import { detectBrowserTimeZone } from "@/lib/timezone";

export function TimezoneSync({
  current,
  enabled = true,
}: {
  current?: string | null;
  enabled?: boolean;
}) {
  const router = useRouter();
  const sent = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const browser = detectBrowserTimeZone();
    if (!browser || sent.current || browser === current) {
      return;
    }
    sent.current = true;
    void postJson<{ timeZone: string }>("/api/v1/timezone", { timeZone: browser })
      .then(() => {
        router.refresh();
      })
      .catch(() => {
        sent.current = false;
      });
  }, [current, enabled, router]);

  return null;
}
