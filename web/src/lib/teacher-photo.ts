const imagePattern = /\.(avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/i;
const imageHosts = new Set([
  "i.ytimg.com",
  "img.youtube.com",
  "images.unsplash.com",
  "plus.unsplash.com",
  "lh3.googleusercontent.com",
  "avatars.githubusercontent.com",
]);

export function parseTeacherPhotoUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("/teachers/")) {
    return trimmed;
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
  const host = parsed.hostname.replace(/^www\./, "");
  if (
    imagePattern.test(parsed.pathname) ||
    imagePattern.test(parsed.href) ||
    imageHosts.has(host)
  ) {
    return parsed.toString();
  }
  return parsed.toString();
}

export function teacherPortraitUrl(input: {
  photoUrl?: string | null;
  videoThumbnailUrl?: string | null;
}) {
  return input.photoUrl || input.videoThumbnailUrl || null;
}
