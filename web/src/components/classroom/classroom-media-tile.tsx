"use client";

import type { ReactNode } from "react";
import { ClassroomOverlay } from "@/components/classroom/classroom-overlay";
import { useT } from "@/components/i18n/i18n-provider";
import type { BrandProfile } from "@/lib/brand";
import type { ClassroomOverlay as Overlay } from "@/lib/classroom-brand";
import { classroomInitials } from "@/lib/classroom-media";

export function ClassroomMediaTile({
  brand,
  overlay,
  name,
  you = false,
  cameraOn,
  micOn,
  speaking = false,
  connecting = false,
  waiting = false,
  screen = false,
  muted = false,
  roleLabel,
  className = "",
  actions,
  videoRef,
}: {
  brand: BrandProfile;
  overlay: Overlay;
  name: string;
  you?: boolean;
  cameraOn: boolean;
  micOn: boolean;
  speaking?: boolean;
  connecting?: boolean;
  waiting?: boolean;
  screen?: boolean;
  muted?: boolean;
  roleLabel?: string;
  className?: string;
  actions?: ReactNode;
  videoRef?: (node: HTMLVideoElement | null) => void;
}) {
  const t = useT();
  const status = waiting
    ? t("classroom.waiting_join")
    : screen
      ? t("classroom.sharing")
      : connecting
        ? t("classroom.connecting")
        : cameraOn
          ? t("classroom.live")
          : micOn
            ? t("classroom.audio_only")
            : t("classroom.waiting_media");

  return (
    <article
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{
        background: overlay.primaryColor,
        boxShadow: speaking
          ? `0 0 0 2px var(--color-background, #f3f4f2), 0 0 0 4px ${overlay.accentColor}`
          : undefined,
      }}
    >
      <video
        ref={videoRef}
        className={`aspect-video w-full transition-opacity ${
          screen ? "object-contain" : "object-cover"
        } ${cameraOn || screen ? "opacity-100" : "opacity-0"}`}
        style={{ background: overlay.primaryColor }}
        autoPlay
        muted={muted}
        playsInline
      />
      {!cameraOn && !screen ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-full text-lg font-extrabold text-white"
            style={{ background: `${overlay.accentColor}33` }}
          >
            {classroomInitials(name)}
          </span>
          <p className="px-3 text-center text-[0.7rem] font-bold text-white/80">{status}</p>
        </div>
      ) : null}
      <ClassroomOverlay brand={brand} overlay={overlay} placement="corner" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-8">
        <p className="text-xs font-bold text-white">
          {name}
          {you ? ` · ${t("classroom.you")}` : ""}
          {roleLabel ? ` · ${roleLabel}` : ""}
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {waiting ? (
            <span className="rounded-full bg-black/45 px-2 py-0.5 text-[0.65rem] font-extrabold text-white">
              {t("classroom.waiting")}
            </span>
          ) : screen ? (
            <span className="rounded-full bg-black/45 px-2 py-0.5 text-[0.65rem] font-extrabold text-white">
              {t("classroom.sharing")}
            </span>
          ) : (
            <>
          <span className="rounded-full bg-black/45 px-2 py-0.5 text-[0.65rem] font-extrabold text-white">
            {cameraOn ? t("classroom.camera_on") : t("classroom.camera_off")}
          </span>
          <span className="rounded-full bg-black/45 px-2 py-0.5 text-[0.65rem] font-extrabold text-white">
            {micOn ? t("classroom.mic_on") : t("classroom.mic_off")}
          </span>
            </>
          )}
          {speaking ? (
            <span
              className="rounded-full px-2 py-0.5 text-[0.65rem] font-extrabold"
              style={{ background: overlay.accentColor, color: overlay.primaryColor }}
            >
              {t("classroom.speaking")}
            </span>
          ) : null}
        </div>
        {actions ? <div className="mt-2 flex flex-wrap gap-1.5">{actions}</div> : null}
      </div>
    </article>
  );
}
