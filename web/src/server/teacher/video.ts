import { parseIntroVideo, type IntroVideoPlayback } from "@/lib/intro-video";
import { ApiError } from "@/server/api/errors";

export function requireIntroVideoUrl(value: string): IntroVideoPlayback {
  const parsed = parseIntroVideo(value);
  if (!parsed) {
    throw new ApiError(
      422,
      "VALIDATION",
      "Use an unlisted YouTube, Vimeo, or direct https .mp4 / .webm link",
    );
  }
  return parsed;
}

export function videoWithPlayback<T extends { externalUrl: string | null }>(file: T) {
  return {
    ...file,
    playback: file.externalUrl ? parseIntroVideo(file.externalUrl) : null,
  };
}
