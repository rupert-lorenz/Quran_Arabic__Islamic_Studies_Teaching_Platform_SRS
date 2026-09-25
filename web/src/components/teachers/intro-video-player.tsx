import {
  introVideoProviderLabel,
  parseIntroVideo,
  type IntroVideoPlayback,
} from "@/lib/intro-video";

export function IntroVideoPlayer({
  playback,
  url,
  title = "Teacher introduction video",
}: {
  playback?: IntroVideoPlayback | null;
  url?: string | null;
  title?: string;
}) {
  const resolved = playback ?? (url ? parseIntroVideo(url) : null);
  if (!resolved) {
    return null;
  }

  return (
    <figure className="overflow-hidden rounded-[1.5rem] bg-brand">
      <div className="relative aspect-video w-full">
        {resolved.embedUrl ? (
          <iframe
            src={resolved.embedUrl}
            title={title}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <video
            src={resolved.watchUrl}
            className="absolute inset-0 h-full w-full"
            controls
            playsInline
            preload="metadata"
          >
            Your browser cannot play this introduction video.
          </video>
        )}
      </div>
      <figcaption className="px-4 py-3 text-sm font-semibold text-white/80">
        {introVideoProviderLabel(resolved.provider)} introduction
      </figcaption>
    </figure>
  );
}
