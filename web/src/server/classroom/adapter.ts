import { createHmac, timingSafeEqual } from "node:crypto";
import { getConfig } from "@/server/config";
import { CLASSROOM_JOIN_TOKEN_TTL_SECONDS } from "@/lib/classroom";
import type { ClassroomParticipantRole } from "@/lib/classroom";

export type ClassroomProvider = "platform" | "livekit";

export type ClassroomJoinTokenPayload = {
  classroomId: string;
  userId: string;
  role: ClassroomParticipantRole;
  exp: number;
};

export type ClassroomProviderJoin = {
  provider: ClassroomProvider;
  token: string;
  expiresAt: string;
  wsUrl?: string;
};

function signingSecret() {
  return (
    process.env.CLASSROOM_API_SECRET ||
    getConfig().SESSION_SECRET ||
    "classroom-dev-secret"
  );
}

function encodePart(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signPayload(payload: object, secret: string) {
  const body = `${encodePart({ alg: "HS256", typ: "JWT" })}.${encodePart(payload)}`;
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifySigned(token: string, secret: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const body = `${parts[0]}.${parts[1]}`;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const actual = parts[2] ?? "";
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(actual);
  if (expectedBuf.length !== actualBuf.length) return null;
  if (!timingSafeEqual(expectedBuf, actualBuf)) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

export function classroomProviderConfigured() {
  return Boolean(
    process.env.CLASSROOM_API_KEY && process.env.CLASSROOM_API_SECRET,
  );
}

export function issueClassroomJoinToken(input: {
  classroomId: string;
  userId: string;
  role: ClassroomParticipantRole;
  displayName: string;
}): ClassroomProviderJoin {
  const exp = Math.floor(Date.now() / 1000) + CLASSROOM_JOIN_TOKEN_TTL_SECONDS;
  const token = signPayload(
    {
      v: 1,
      cid: input.classroomId,
      uid: input.userId,
      role: input.role,
      exp,
    },
    signingSecret(),
  );
  const expiresAt = new Date(exp * 1000).toISOString();
  const livekitKey = process.env.CLASSROOM_API_KEY;
  const livekitSecret = process.env.CLASSROOM_API_SECRET;
  const wsUrl = process.env.CLASSROOM_URL;

  if (livekitKey && livekitSecret && wsUrl) {
    return {
      provider: "livekit",
      token: signPayload(
        {
          iss: livekitKey,
          sub: input.userId,
          name: input.displayName,
          nbf: Math.floor(Date.now() / 1000) - 10,
          exp,
          video: {
            roomJoin: true,
            room: input.classroomId,
            canPublish: input.role !== "parent",
            canSubscribe: true,
            canPublishData: true,
          },
        },
        livekitSecret,
      ),
      expiresAt,
      wsUrl,
    };
  }

  return {
    provider: "platform",
    token,
    expiresAt,
  };
}

export function verifyClassroomJoinToken(
  token: string | null | undefined,
  classroomId: string,
  userId: string,
): ClassroomJoinTokenPayload | null {
  if (!token) return null;
  const payload = verifySigned(token, signingSecret());
  if (!payload) return null;
  if (payload.cid !== classroomId || payload.uid !== userId) return null;
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) {
    return null;
  }
  if (
    payload.role !== "teacher" &&
    payload.role !== "student" &&
    payload.role !== "parent" &&
    payload.role !== "staff"
  ) {
    return null;
  }
  return {
    classroomId,
    userId,
    role: payload.role,
    exp: payload.exp,
  };
}
