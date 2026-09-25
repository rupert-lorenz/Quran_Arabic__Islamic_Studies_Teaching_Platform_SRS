export const CLASSROOM_MAX_RECORDING_BYTES = 64 * 1024 * 1024;
export const CLASSROOM_RECORDING_CHUNK_MS = 4000;
export const CLASSROOM_RECORDING_CHUNK_MAX_BYTES = 1024 * 1024;

const RECORDER_TYPES = [
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9,opus",
  "video/webm",
  "video/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
];

export function classroomRecordingMime() {
  if (typeof MediaRecorder === "undefined") return "";
  return RECORDER_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function classroomRecordingExtension(mime: string) {
  return mime.includes("mp4") ? "mp4" : "webm";
}

export function formatClassroomRecordingTime(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(rest).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function collectClassroomRecordingStreams(streams: Array<MediaStream | null | undefined>) {
  return streams.filter((stream): stream is MediaStream => {
    if (!stream) return false;
    return stream.getTracks().some((track) => track.readyState === "live");
  });
}

export function startClassroomRecordingMix(inputs: MediaStream[]) {
  const audioCtx = new AudioContext();
  void audioCtx.resume();
  const dest = audioCtx.createMediaStreamDestination();
  const videos: HTMLVideoElement[] = [];
  for (const stream of inputs) {
    if (stream.getAudioTracks().some((track) => track.readyState === "live")) {
      try {
        audioCtx.createMediaStreamSource(stream).connect(dest);
      } catch {
        // A stream may already be wired into another context.
      }
    }
    const videoTrack = stream.getVideoTracks().find((track) => track.readyState === "live");
    if (!videoTrack) continue;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = new MediaStream([videoTrack]);
    void video.play().catch(() => undefined);
    videos.push(video);
  }

  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext("2d");
  let frame = 0;
  const draw = () => {
    if (!ctx) return;
    ctx.fillStyle = "#294634";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const live = videos.filter((video) => video.readyState >= 2);
    if (live.length) {
      const cols = live.length > 1 ? 2 : 1;
      const rows = Math.ceil(live.length / cols);
      const width = canvas.width / cols;
      const height = canvas.height / rows;
      live.forEach((video, index) => {
        ctx.drawImage(
          video,
          (index % cols) * width,
          Math.floor(index / cols) * height,
          width,
          height,
        );
      });
    }
    frame = window.requestAnimationFrame(draw);
  };
  draw();

  const canvasStream = canvas.captureStream(10);
  const mixed = new MediaStream([
    ...(videos.length ? canvasStream.getVideoTracks() : []),
    ...dest.stream.getAudioTracks(),
  ]);

  return {
    stream: mixed,
    stop() {
      window.cancelAnimationFrame(frame);
      for (const video of videos) {
        video.pause();
        video.srcObject = null;
      }
      void audioCtx.close();
      mixed.getTracks().forEach((track) => track.stop());
      canvasStream.getTracks().forEach((track) => track.stop());
    },
  };
}

export function createClassroomMediaRecorder(
  stream: MediaStream,
  onChunk: (blob: Blob) => void,
) {
  const mime = classroomRecordingMime();
  if (!mime || typeof MediaRecorder === "undefined") {
    throw new Error("This browser cannot record the lesson");
  }
  if (!stream.getTracks().length) {
    throw new Error("Turn on a camera or microphone before recording.");
  }
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: stream.getVideoTracks().length ? 400_000 : undefined,
    audioBitsPerSecond: 64_000,
  });
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) onChunk(event.data);
  };
  recorder.start(CLASSROOM_RECORDING_CHUNK_MS);
  return recorder;
}
