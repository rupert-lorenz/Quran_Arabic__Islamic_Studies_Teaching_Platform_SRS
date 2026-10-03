import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "./config";

const KEY = "alharamain.session";

export type MobileClient = "ios" | "android";

export function clientPlatform(): MobileClient {
  return Platform.OS === "ios" ? "ios" : "android";
}

export async function loadToken() {
  if (Platform.OS === "web") return null;
  return SecureStore.getItemAsync(KEY);
}

export async function saveToken(token: string) {
  if (Platform.OS === "web") return;
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearToken() {
  if (Platform.OS === "web") return;
  await SecureStore.deleteItemAsync(KEY);
}

export async function api(
  path: string,
  token: string | null,
  init?: { method?: string; body?: unknown; auth?: string | null },
) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Origin: API_URL,
    "X-AlHaramain-Client": clientPlatform(),
  };
  if (init?.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const auth = init?.auth === undefined ? token : init.auth;
  if (auth) headers.Authorization = `Bearer ${auth}`;

  const response = await fetch(`${API_URL}${path}`, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const json = (await response.json().catch(() => null)) as {
    ok?: boolean;
    data?: unknown;
    error?: { message?: string };
  } | null;
  if (!response.ok || !json?.ok) {
    throw new Error(json?.error?.message || "The request failed.");
  }
  return json.data;
}
