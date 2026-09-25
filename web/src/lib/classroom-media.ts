export const CLASSROOM_ICE: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export const CLASSROOM_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

export const CLASSROOM_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  facingMode: "user",
};

export type ClassroomMediaFlags = {
  cameraOn: boolean;
  micOn: boolean;
};

export function classroomMediaConstraints(video: boolean): MediaStreamConstraints {
  return {
    audio: CLASSROOM_AUDIO_CONSTRAINTS,
    video: video ? CLASSROOM_VIDEO_CONSTRAINTS : false,
  };
}

export function classroomMediaAttempts(canPublish: boolean): MediaStreamConstraints[] {
  if (!canPublish) {
    return [{ audio: CLASSROOM_AUDIO_CONSTRAINTS, video: false }];
  }
  return [
    classroomMediaConstraints(true),
    classroomMediaConstraints(false),
    { audio: false, video: CLASSROOM_VIDEO_CONSTRAINTS },
  ];
}

export function classroomMediaAllowed() {
  if (typeof window === "undefined") return true;
  if (window.isSecureContext) return true;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export function mediaFlagsFromStream(stream: MediaStream | null): ClassroomMediaFlags {
  if (!stream) {
    return { cameraOn: false, micOn: false };
  }
  return {
    cameraOn: stream
      .getVideoTracks()
      .some((track) => track.readyState === "live" && track.enabled && !track.muted),
    micOn: stream
      .getAudioTracks()
      .some((track) => track.readyState === "live" && track.enabled),
  };
}

export function classroomInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

export type ClassroomMediaControlAction = "mute" | "camera_off" | "screen_off";

export function parseClassroomMediaControl(value: unknown): ClassroomMediaControlAction | null {
  if (!value || typeof value !== "object") return null;
  const action = (value as { action?: unknown }).action;
  return action === "mute" || action === "camera_off" || action === "screen_off"
    ? action
    : null;
}

export function markScreenTrack(track: MediaStreamTrack) {
  track.contentHint = "detail";
}

export async function listClassroomDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return { cameras: [] as MediaDeviceInfo[], mics: [] as MediaDeviceInfo[] };
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  return {
    cameras: devices.filter((item) => item.kind === "videoinput"),
    mics: devices.filter((item) => item.kind === "audioinput"),
  };
}

export function trackDeviceId(stream: MediaStream | null, kind: "audio" | "video") {
  const track =
    kind === "video" ? stream?.getVideoTracks()[0] : stream?.getAudioTracks()[0];
  return track?.getSettings().deviceId ?? "";
}

export function parseClassroomMediaFlags(value: unknown): ClassroomMediaFlags {
  if (!value || typeof value !== "object") {
    return { cameraOn: false, micOn: false };
  }
  const item = value as { cameraOn?: unknown; micOn?: unknown };
  return {
    cameraOn: item.cameraOn === true,
    micOn: item.micOn === true,
  };
}

export function startSpeakingMonitor(
  stream: MediaStream,
  onSpeaking: (speaking: boolean) => void,
) {
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor || !stream.getAudioTracks().length) {
    return () => {};
  }
  const context = new Ctor();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.65;
  source.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);
  let frame = 0;
  let last = false;
  const tick = () => {
    analyser.getByteFrequencyData(data);
    let sum = 0;
    for (const value of data) sum += value;
    const speaking = sum / data.length > 16;
    if (speaking !== last) {
      last = speaking;
      onSpeaking(speaking);
    }
    frame = window.requestAnimationFrame(tick);
  };
  void context.resume();
  frame = window.requestAnimationFrame(tick);
  return () => {
    window.cancelAnimationFrame(frame);
    void context.close();
  };
}
