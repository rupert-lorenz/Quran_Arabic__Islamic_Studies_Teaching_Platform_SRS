import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { getConfig } from "@/server/config";

export const RECORDING_ENVELOPE_MAGIC = Buffer.from("AHSR");
const RECORDING_ENVELOPE_VERSION = 1;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const LENGTH_SIZE = 4;
const HEADER_LENGTH = RECORDING_ENVELOPE_MAGIC.byteLength + 1;

export function classroomRecordingStorageKey(
  classroomId: string,
  recordingId: string,
  extension = "webm",
) {
  return `recording:${classroomId}:${recordingId}:lesson.${extension}`;
}

export function isClassroomRecordingStorageKey(storageKey: string) {
  return (
    storageKey.startsWith("recording:") ||
    storageKey.includes(":recording:")
  );
}

function recordingKey() {
  const config = getConfig();
  const secret = config.SESSION_SECRET;
  if (!secret) {
    if (config.isLive) {
      throw new Error("SESSION_SECRET is required to store lesson recordings");
    }
    return createHash("sha256").update("dev-recording-key").digest();
  }
  return createHash("sha256").update(`recording-v1:${secret}`).digest();
}

export function emptySecureRecordingEnvelope() {
  return Buffer.concat([
    RECORDING_ENVELOPE_MAGIC,
    Buffer.from([RECORDING_ENVELOPE_VERSION]),
  ]);
}

export function isSecureRecordingEnvelope(stored: Buffer) {
  return (
    stored.byteLength >= HEADER_LENGTH &&
    stored.subarray(0, RECORDING_ENVELOPE_MAGIC.byteLength).equals(RECORDING_ENVELOPE_MAGIC) &&
    stored[RECORDING_ENVELOPE_MAGIC.byteLength] === RECORDING_ENVELOPE_VERSION
  );
}

function encryptFrame(plain: Buffer) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", recordingKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  const length = Buffer.alloc(LENGTH_SIZE);
  length.writeUInt32BE(encrypted.byteLength);
  return Buffer.concat([length, iv, tag, encrypted]);
}

function decryptFrame(stored: Buffer, offset: number) {
  const frameStart = offset + LENGTH_SIZE + IV_LENGTH + TAG_LENGTH;
  if (stored.byteLength < offset + LENGTH_SIZE) {
    throw new Error("Recording envelope is truncated");
  }
  const length = stored.readUInt32BE(offset);
  const end = frameStart + length;
  if (length < 0 || end > stored.byteLength) {
    throw new Error("Recording envelope is truncated");
  }
  const iv = stored.subarray(offset + LENGTH_SIZE, offset + LENGTH_SIZE + IV_LENGTH);
  const tag = stored.subarray(
    offset + LENGTH_SIZE + IV_LENGTH,
    offset + LENGTH_SIZE + IV_LENGTH + TAG_LENGTH,
  );
  const data = stored.subarray(frameStart, end);
  const decipher = createDecipheriv("aes-256-gcm", recordingKey(), iv);
  decipher.setAuthTag(tag);
  return {
    plain: Buffer.concat([decipher.update(data), decipher.final()]),
    next: end,
  };
}

export function appendSecureRecordingChunk(stored: Buffer, chunk: Buffer) {
  if (!chunk.byteLength) return stored;
  let base = stored;
  if (!base.byteLength) {
    base = emptySecureRecordingEnvelope();
  } else if (!isSecureRecordingEnvelope(base)) {
    base = Buffer.concat([emptySecureRecordingEnvelope(), encryptFrame(base)]);
  }
  return Buffer.concat([base, encryptFrame(chunk)]);
}

export function openSecureRecordingBytes(stored: Buffer) {
  if (!stored.byteLength) return Buffer.alloc(0);
  if (!isSecureRecordingEnvelope(stored)) {
    return stored;
  }
  const parts: Buffer[] = [];
  let offset = HEADER_LENGTH;
  while (offset < stored.byteLength) {
    const frame = decryptFrame(stored, offset);
    parts.push(frame.plain);
    offset = frame.next;
  }
  return Buffer.concat(parts);
}
