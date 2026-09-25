export type ApiErrorBody = {
  ok: false;
  error?: {
    code?: string;
    message?: string;
    details?: { path?: string; message?: string }[];
  };
};

function apiErrorMessage(json: ApiErrorBody) {
  return (
    json.error?.details?.[0]?.message || json.error?.message || "Request failed"
  );
}

export class ApiClientError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
  }
}

function throwApiFailure(json: ApiErrorBody | { ok: true }, fallback: string): never {
  if (!json.ok) {
    throw new ApiClientError(apiErrorMessage(json), json.error?.code);
  }
  throw new ApiClientError(fallback);
}

export async function getJson<T>(url: string) {
  const response = await fetch(url, {
    credentials: "include",
  });

  const json = (await response.json()) as
    | { ok: true; data: T }
    | ApiErrorBody;

  if (!response.ok || !json.ok) {
    throwApiFailure(json, "Request failed");
  }

  return json.data;
}

export async function postJson<T>(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await response.json()) as
    | { ok: true; data: T }
    | ApiErrorBody;

  if (!response.ok || !json.ok) {
    throwApiFailure(json, "Request failed");
  }

  return json.data;
}

export async function putJson<T>(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await response.json()) as
    | { ok: true; data: T }
    | ApiErrorBody;

  if (!response.ok || !json.ok) {
    throwApiFailure(json, "Request failed");
  }

  return json.data;
}

export async function patchJson<T>(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await response.json()) as
    | { ok: true; data: T }
    | ApiErrorBody;

  if (!response.ok || !json.ok) {
    throwApiFailure(json, "Request failed");
  }

  return json.data;
}

export async function postForm<T>(url: string, body: FormData) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    body,
  });

  const json = (await response.json()) as
    | { ok: true; data: T }
    | ApiErrorBody;

  if (!response.ok || !json.ok) {
    throwApiFailure(json, "Request failed");
  }

  return json.data;
}

export async function deleteJson<T>(url: string) {
  const response = await fetch(url, {
    method: "DELETE",
    credentials: "include",
  });

  const json = (await response.json()) as
    | { ok: true; data: T }
    | ApiErrorBody;

  if (!response.ok || !json.ok) {
    throwApiFailure(json, "Request failed");
  }

  return json.data;
}

export const fieldClass =
  "min-h-12 w-full rounded-2xl border border-line bg-background px-4 text-base font-semibold text-brand";
