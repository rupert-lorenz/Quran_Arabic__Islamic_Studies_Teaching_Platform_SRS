"use client";

import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/i18n-provider";

export function ClassroomMediaControls({
  cameraOn,
  micOn,
  cameras,
  mics,
  cameraId,
  micId,
  canMuteAll,
  sharing,
  canShare,
  onToggleCamera,
  onToggleMic,
  onToggleShare,
  onCameraChange,
  onMicChange,
  onMuteAll,
}: {
  cameraOn: boolean;
  micOn: boolean;
  cameras: MediaDeviceInfo[];
  mics: MediaDeviceInfo[];
  cameraId: string;
  micId: string;
  canMuteAll: boolean;
  sharing: boolean;
  canShare: boolean;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onToggleShare: () => void;
  onCameraChange: (deviceId: string) => void;
  onMicChange: (deviceId: string) => void;
  onMuteAll: () => void;
}) {
  const t = useT();
  return (
    <div className="mt-4 space-y-3">
      <p className="text-xs font-extrabold uppercase text-brand-soft">
        {t("classroom.controls")}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onToggleCamera}>
          {cameraOn ? t("classroom.camera_stop") : t("classroom.camera_start")}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onToggleMic}>
          {micOn ? t("classroom.mute") : t("classroom.unmute")}
        </Button>
        {canShare ? (
          <Button type="button" size="sm" variant="secondary" onClick={onToggleShare}>
            {sharing ? t("classroom.stop_share") : t("classroom.share_screen")}
          </Button>
        ) : null}
        {canMuteAll ? (
          <Button type="button" size="sm" variant="ghost" onClick={onMuteAll}>
            {t("classroom.mute_all")}
          </Button>
        ) : null}
      </div>
      {cameras.length > 1 || mics.length > 1 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {cameras.length > 1 ? (
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-muted">
                {t("classroom.devices_camera")}
              </span>
              <select
                className="min-h-11 w-full rounded-2xl border border-line bg-background px-3 text-sm font-semibold text-brand"
                value={cameraId}
                onChange={(event) => onCameraChange(event.target.value)}
              >
                {cameras.map((device, index) => (
                  <option key={device.deviceId || index} value={device.deviceId}>
                    {device.label.trim() || `${t("classroom.devices_camera")} ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {mics.length > 1 ? (
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-muted">
                {t("classroom.devices_mic")}
              </span>
              <select
                className="min-h-11 w-full rounded-2xl border border-line bg-background px-3 text-sm font-semibold text-brand"
                value={micId}
                onChange={(event) => onMicChange(event.target.value)}
              >
                {mics.map((device, index) => (
                  <option key={device.deviceId || index} value={device.deviceId}>
                    {device.label.trim() || `${t("classroom.devices_mic")} ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
