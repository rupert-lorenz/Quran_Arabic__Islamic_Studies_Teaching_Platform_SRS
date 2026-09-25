import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type BinaryLike,
  type ScryptOptions,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: BinaryLike,
  salt: BinaryLike,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;
const KEY_LEN = 32;
const N = 16384;
const R = 8;
const P = 1;
const MAX_MEM = 64 * 1024 * 1024;

let dummyHash: string | undefined;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = (await scrypt(password, salt, KEY_LEN, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEM,
  })) as Buffer;

  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4], "base64url");
  const expected = Buffer.from(parts[5], "base64url");

  if (!n || !r || !p || salt.length === 0 || expected.length === 0) {
    return false;
  }

  const derived = (await scrypt(password, salt, expected.length, {
    N: n,
    r,
    p,
    maxmem: MAX_MEM,
  })) as Buffer;

  if (derived.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(derived, expected);
}

export async function verifyPasswordOrDummy(password: string, stored?: string | null) {
  dummyHash ??= await hashPassword("dummy-password-not-used");
  return verifyPassword(password, stored ?? dummyHash);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
