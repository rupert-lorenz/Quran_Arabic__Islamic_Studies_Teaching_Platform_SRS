import { ApiError } from "@/server/api/errors";

export const integrationKeys = [
  "payments",
  "payouts",
  "classroom",
  "storage",
  "email",
  "ai",
] as const;

export type IntegrationKey = (typeof integrationKeys)[number];

export type IntegrationDescriptor = {
  key: IntegrationKey;
  purpose: string;
  rules: string[];
  envSecrets: string[];
};

export const integrations: IntegrationDescriptor[] = [
  {
    key: "payments",
    purpose: "Checkout, refunds, and payment confirmation for marketplace finance",
    rules: [
      "Card numbers, CVC, and raw card PANs are never stored",
      "Provider tokens and payment IDs only",
      "Webhooks must verify HMAC signatures before any state change",
    ],
    envSecrets: ["PAYMENTS_SECRET_KEY", "PAYMENTS_WEBHOOK_SECRET"],
  },
  {
    key: "payouts",
    purpose: "Teacher payouts and connected accounts",
    rules: [
      "Platform never stores bank account numbers",
      "Payout state is mirrored from the provider after signed webhooks",
    ],
    envSecrets: ["PAYOUTS_SECRET_KEY", "PAYOUTS_WEBHOOK_SECRET"],
  },
  {
    key: "classroom",
    purpose: "Live lesson rooms and recordings metadata",
    rules: [
      "Join tokens are short-lived and scoped to one lesson",
      "Recording binaries go to object storage, not the app server",
      "Recording bytes are encrypted at rest and never listed with lesson files",
    ],
    envSecrets: ["CLASSROOM_API_KEY", "CLASSROOM_API_SECRET"],
  },
  {
    key: "storage",
    purpose: "Private documents, intro videos, and recordings",
    rules: [
      "Postgres stores storage_key only",
      "Clients receive time-limited signed URLs, never bucket credentials",
      "Lesson recordings are encrypted before they are written",
    ],
    envSecrets: ["STORAGE_ACCESS_KEY", "STORAGE_SECRET_KEY"],
  },
  {
    key: "email",
    purpose: "Transactional mail such as verification and booking notices",
    rules: ["Templates and provider IDs only; no third-party marketing keys in the client"],
    envSecrets: ["EMAIL_API_KEY"],
  },
  {
    key: "ai",
    purpose: "Modular tutoring assistance through a server adapter",
    rules: [
      "AI faculties are independent modules behind one server adapter",
      "The browser never receives provider keys",
      "Child-identifying data is minimised before any model call",
      "Prompts and outputs are not used to train public models",
      "OpenAI and Deepgram stay reserved until their server secrets are set",
    ],
    envSecrets: ["AI_API_KEY"],
  },
];

export function getIntegrationStatus() {
  return integrations.map((integration) => ({
    key: integration.key,
    purpose: integration.purpose,
    rules: integration.rules,
    configured: integration.envSecrets.every((name) => Boolean(process.env[name])),
  }));
}

export function requireIntegration(key: IntegrationKey) {
  const integration = integrations.find((item) => item.key === key);
  if (!integration) {
    throw new ApiError(500, "INTERNAL", "Unknown integration");
  }

  const missing = integration.envSecrets.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new ApiError(
      503,
      "INTEGRATION_NOT_CONFIGURED",
      `${key} is not configured`,
    );
  }

  return integration;
}
