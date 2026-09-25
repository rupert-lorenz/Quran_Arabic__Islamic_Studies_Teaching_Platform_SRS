export const exampleIntroVideoUrl = "https://www.youtube.com/watch?v=jNQXAC9IVRw";

export const introVideoGuidance = [
  "Keep it between 60 and 180 seconds.",
  "Show your face and speak clearly in English or Arabic.",
  "Say your name, the subjects you teach, and the ages you teach.",
  "Use an unlisted YouTube or Vimeo link, or a direct https .mp4 / .webm file.",
] as const;

export type IntroVideoProvider = "youtube" | "vimeo" | "file";

export type IntroVideoPlayback = {
  provider: IntroVideoProvider;
  watchUrl: string;
  embedUrl: string | null;
  thumbnailUrl: string | null;
};

const youtubeIdPattern = /^[A-Za-z0-9_-]{11}$/;
const vimeoIdPattern = /^\d{6,12}$/;
const directVideoPattern = /\.(mp4|webm|ogg|m4v)(?:$|[?#])/i;

function youtubeIdFromUrl(parsed: URL) {
  const host = parsed.hostname.replace(/^www\./, "").replace(/^m\./, "");
  if (host === "youtu.be") {
    return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (parsed.searchParams.get("v")) {
      return parsed.searchParams.get("v");
    }
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (
      parts[0] &&
      ["embed", "shorts", "live", "v"].includes(parts[0]) &&
      parts[1]
    ) {
      return parts[1];
    }
  }
  return null;
}

function vimeoIdFromUrl(parsed: URL) {
  const host = parsed.hostname.replace(/^www\./, "");
  if (host === "player.vimeo.com") {
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts[0] === "video" ? parts[1] ?? null : null;
  }
  if (host === "vimeo.com") {
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length === 1) {
      return parts[0];
    }
    if (parts[0] === "video" && parts[1]) {
      return parts[1];
    }
    const last = parts.at(-1);
    return last && vimeoIdPattern.test(last) ? last : null;
  }
  return null;
}

export function parseIntroVideo(value: string): IntroVideoPlayback | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") {
    return null;
  }

  const youtubeId = youtubeIdFromUrl(parsed);
  if (youtubeId && youtubeIdPattern.test(youtubeId)) {
    return {
      provider: "youtube",
      watchUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1`,
      thumbnailUrl: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
    };
  }

  const vimeoId = vimeoIdFromUrl(parsed);
  if (vimeoId && vimeoIdPattern.test(vimeoId)) {
    return {
      provider: "vimeo",
      watchUrl: `https://vimeo.com/${vimeoId}`,
      embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
      thumbnailUrl: null,
    };
  }

  if (directVideoPattern.test(parsed.pathname) || directVideoPattern.test(parsed.href)) {
    return {
      provider: "file",
      watchUrl: parsed.toString(),
      embedUrl: null,
      thumbnailUrl: null,
    };
  }

  return null;
}

export function introVideoProviderLabel(provider: IntroVideoProvider) {
  if (provider === "youtube") {
    return "YouTube";
  }
  if (provider === "vimeo") {
    return "Vimeo";
  }
  return "Video file";
}
