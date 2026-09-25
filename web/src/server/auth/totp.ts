import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { getConfig } from "@/server/config";

const STEP_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function buildOtpauthUrl(input: {
  issuer: string;
  accountName: string;
  secret: string;
}) {
  const issuer = encodeURIComponent(input.issuer);
  const account = encodeURIComponent(input.accountName);
  return `otpauth://totp/${issuer}:${account}?secret=${input.secret}&issuer=${issuer}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

export function generateTotpCode(secret: string, step = currentStep()) {
  const key = base32Decode(secret);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", key).update(message).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function verifyTotpCode(
  secret: string,
  code: string,
  lastUsedStep?: string | null,
) {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) {
    return { ok: false as const };
  }

  const now = currentStep();
  for (let delta = -WINDOW; delta <= WINDOW; delta += 1) {
    const step = now + delta;
    if (lastUsedStep && lastUsedStep === String(step)) {
      continue;
    }
    const expected = generateTotpCode(secret, step);
    if (safeEqual(expected, normalized)) {
      return { ok: true as const, step: String(step) };
    }
  }

  return { ok: false as const };
}

export function encryptTotpSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", totpKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptTotpSecret(payload: string) {
  const [version, iv, tag, data] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !data) {
    throw new Error("Invalid TOTP secret payload");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    totpKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(data, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const hex = randomBytes(4).toString("hex");
    return `${hex.slice(0, 4)}-${hex.slice(4)}`;
  });
}

export function normalizeRecoveryCode(value: string) {
  const hex = value.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
  if (hex.length !== 8) {
    return null;
  }
  return `${hex.slice(0, 4)}-${hex.slice(4)}`;
}

export function hashRecoveryCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function currentStep() {
  return Math.floor(Date.now() / 1000 / STEP_SECONDS);
}

function totpKey() {
  const config = getConfig();
  const secret = config.SESSION_SECRET;
  if (!secret) {
    if (config.isLive) {
      throw new Error("SESSION_SECRET is required to store authenticator secrets");
    }
    return createHash("sha256").update("dev-totp-key").digest();
  }

  return createHash("sha256").update(`totp-v1:${secret}`).digest();
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function base32Encode(bytes: Buffer) {
  let bits = "";
  for (const byte of bytes) {
    bits += byte.toString(2).padStart(8, "0");
  }
  const leftover = bits.length % 5;
  if (leftover) {
    bits += "0".repeat(5 - leftover);
  }

  let output = "";
  for (let index = 0; index < bits.length; index += 5) {
    output += ALPHABET[Number.parseInt(bits.slice(index, index + 5), 2)];
  }
  return output;
}

function base32Decode(value: string) {
  const cleaned = value.replace(/=+$/g, "").toUpperCase();
  let bits = "";
  for (const char of cleaned) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error("Invalid authenticator secret");
    }
    bits += index.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}
