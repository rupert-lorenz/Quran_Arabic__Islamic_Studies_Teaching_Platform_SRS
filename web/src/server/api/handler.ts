import { ZodError, type ZodType } from "zod";
import { getConfig } from "@/server/config";
import { consumeRateLimit, type RateLimitKind } from "@/redis/rate-limit";
import { getActor, requireActor, requirePermission, type ApiActor } from "./auth";
import { assertSameOrigin } from "./csrf";
import { ApiError, isApiError } from "./errors";
import {
  getClientIp,
  getRequestId,
  getUserAgent,
  REQUEST_ID_HEADER,
} from "./request";

const MAX_JSON_BYTES = 32 * 1024;

export type ApiContext<TInput = unknown> = {
  request: Request;
  requestId: string;
  ip: string;
  userAgent: string;
  actor: ApiActor | null;
  input: TInput;
  params: Record<string, string>;
};

type ApiRouteOptions<TInput> = {
  auth?: "public" | "session";
  permission?: string | string[];
  csrf?: boolean;
  rateLimit?: RateLimitKind | false;
  envelope?: boolean;
  input?: ZodType<TInput>;
  maxBody?: number;
};

function withApiHeaders(
  response: Response,
  requestId: string,
  rate?: { limit: number; remaining: number; resetSeconds: number },
) {
  response.headers.set(REQUEST_ID_HEADER, requestId);
  response.headers.set("Cache-Control", "no-store");
  if (rate) {
    response.headers.set("X-RateLimit-Limit", String(rate.limit));
    response.headers.set("X-RateLimit-Remaining", String(rate.remaining));
    response.headers.set("X-RateLimit-Reset", String(rate.resetSeconds));
  }
  return response;
}

function errorMessage(error: unknown, requestId: string) {
  if (isApiError(error)) {
    return {
      status: error.status,
      body: {
        ok: false as const,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
        requestId,
      },
    };
  }

  if (error instanceof ZodError) {
    return {
      status: 422,
      body: {
        ok: false as const,
        error: {
          code: "VALIDATION",
          message: "Request validation failed",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        requestId,
      },
    };
  }

  const config = getConfig();
  console.error("api_unhandled_error", {
    requestId,
    message: error instanceof Error ? error.message : "unknown",
    stack: config.isDevelopment && error instanceof Error ? error.stack : undefined,
  });

  return {
    status: 500,
    body: {
      ok: false as const,
      error: {
        code: "INTERNAL",
        message: config.isDevelopment
          ? error instanceof Error
            ? error.message
            : "Internal server error"
          : "Internal server error",
      },
      requestId,
    },
  };
}

async function readJson(request: Request, maxBytes = MAX_JSON_BYTES) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA", "JSON content type is required");
  }

  const raw = await request.text();
  if (raw.length > maxBytes) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Request body is too large");
  }

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body is not valid JSON");
  }
}

export function apiRoute<TInput = unknown, TData = unknown>(
  options: ApiRouteOptions<TInput>,
  handle: (ctx: ApiContext<TInput>) => Promise<TData | Response>,
) {
  return async (
    request: Request,
    context?: { params?: Promise<Record<string, string>> },
  ) => {
    const requestId = getRequestId(request);
    let rate:
      | { limit: number; remaining: number; resetSeconds: number }
      | undefined;

    try {
      const ip = getClientIp(request);
      const config = getConfig();

      if (options.rateLimit !== false) {
        const kind = options.rateLimit ?? (options.auth === "session" ? "sensitive" : "public");
        try {
          const result = await consumeRateLimit(kind, `${ip}:${new URL(request.url).pathname}`);
          rate = result;
          if (!result.allowed) {
            throw new ApiError(429, "RATE_LIMITED", "Too many requests");
          }
        } catch (error) {
          if (isApiError(error)) throw error;
          if (config.isLive && kind !== "health") {
            throw new ApiError(503, "SERVICE_UNAVAILABLE", "Rate limit service is unavailable");
          }
        }
      }

      const mutating = !["GET", "HEAD", "OPTIONS"].includes(request.method);
      const checkCsrf = options.csrf ?? options.auth === "session";
      if (checkCsrf && mutating) {
        assertSameOrigin(request);
      }

      const actor = await getActor(request);
      if (options.auth === "session") {
        requireActor(actor);
      }
      if (options.permission) {
        requirePermission(requireActor(actor), options.permission);
      }

      let input = undefined as TInput;
      if (options.input) {
        const query = Object.fromEntries(new URL(request.url).searchParams.entries());
        const body = mutating ? await readJson(request, options.maxBody) : {};
        input = options.input.parse(
          mutating ? { ...query, ...(typeof body === "object" && body ? body : {}) } : query,
        );
      }

      const result = await handle({
        request,
        requestId,
        ip,
        userAgent: getUserAgent(request),
        actor,
        input,
        params: context?.params ? await context.params : {},
      });

      if (result instanceof Response) {
        return withApiHeaders(result, requestId, rate);
      }

      const status =
        result && typeof result === "object" && "ok" in result && result.ok === false
          ? 503
          : 200;

      const body =
        options.envelope === false
          ? result
          : { ok: true, data: result, requestId };

      return withApiHeaders(Response.json(body, { status }), requestId, rate);
    } catch (error) {
      const mapped = errorMessage(error, requestId);
      const response = Response.json(mapped.body, { status: mapped.status });
      if (mapped.status === 429 && rate) {
        response.headers.set("Retry-After", String(rate.resetSeconds));
      }
      return withApiHeaders(response, requestId, rate);
    }
  };
}
