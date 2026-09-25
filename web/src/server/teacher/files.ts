export function teacherFileStorageKey(
  userId: string,
  purpose: string,
  originalName: string,
  externalUrl: string | null,
) {
  return externalUrl
    ? `external:${userId}:${externalUrl}`
    : `declared:${userId}:${purpose}:${crypto.randomUUID()}:${originalName}`;
}

export function externalUrlFromStorageKey(storageKey: string) {
  if (!storageKey.startsWith("external:")) {
    return null;
  }

  const rest = storageKey.slice("external:".length);
  const https = rest.indexOf("https://");
  const http = rest.indexOf("http://");
  const start =
    https >= 0 && (http < 0 || https <= http)
      ? https
      : http >= 0
        ? http
        : -1;
  return start >= 0 ? rest.slice(start) : rest;
}
