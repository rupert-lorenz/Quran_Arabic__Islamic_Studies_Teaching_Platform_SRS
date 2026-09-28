import {
  AI_JOB_KINDS,
  aiKindRequiresReview,
  type AiJobKind,
} from "@/lib/ai-systems";

export const AI_SHARED_HOOKS = [
  "safety",
  "review",
  "identification",
  "decisions",
] as const;
export type AiSharedHook = (typeof AI_SHARED_HOOKS)[number];

export const AI_PROVIDER_IDS = ["builtin", "openai", "deepgram"] as const;
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export const AI_MODULE_IDS = [
  "architecture",
  "transcription",
  "summary",
  "notes",
  "homework",
  "quiz",
  "recommendation",
  "search",
  "review",
  "identification",
  "safety",
  "decisions",
  "support",
] as const;
export type AiModuleId = (typeof AI_MODULE_IDS)[number];

export const AI_MODULE_LAYERS = [
  "platform",
  "capability",
  "policy",
  "planned",
] as const;
export type AiModuleLayer = (typeof AI_MODULE_LAYERS)[number];

export type AiModuleDefinition = {
  id: AiModuleId;
  kind: AiJobKind | null;
  layer: AiModuleLayer;
  live: boolean;
  independent: boolean;
  requiresReview: boolean;
  providerBound: boolean;
  hooks: AiSharedHook[];
};

export const AI_MODULES: AiModuleDefinition[] = [
  {
    id: "architecture",
    kind: null,
    layer: "platform",
    live: true,
    independent: true,
    requiresReview: false,
    providerBound: false,
    hooks: [...AI_SHARED_HOOKS],
  },
  {
    id: "transcription",
    kind: "transcription",
    layer: "capability",
    live: true,
    independent: true,
    requiresReview: true,
    providerBound: true,
    hooks: [...AI_SHARED_HOOKS],
  },
  {
    id: "summary",
    kind: "summary",
    layer: "capability",
    live: true,
    independent: true,
    requiresReview: true,
    providerBound: true,
    hooks: [...AI_SHARED_HOOKS],
  },
  {
    id: "notes",
    kind: "notes",
    layer: "capability",
    live: true,
    independent: true,
    requiresReview: false,
    providerBound: true,
    hooks: ["safety", "identification"],
  },
  {
    id: "homework",
    kind: "homework",
    layer: "capability",
    live: true,
    independent: true,
    requiresReview: true,
    providerBound: true,
    hooks: [...AI_SHARED_HOOKS],
  },
  {
    id: "quiz",
    kind: "quiz",
    layer: "capability",
    live: true,
    independent: true,
    requiresReview: true,
    providerBound: true,
    hooks: [...AI_SHARED_HOOKS],
  },
  {
    id: "recommendation",
    kind: "recommendation",
    layer: "capability",
    live: true,
    independent: true,
    requiresReview: true,
    providerBound: true,
    hooks: [...AI_SHARED_HOOKS],
  },
  {
    id: "search",
    kind: "search",
    layer: "capability",
    live: true,
    independent: true,
    requiresReview: false,
    providerBound: false,
    hooks: ["safety"],
  },
  {
    id: "review",
    kind: null,
    layer: "policy",
    live: true,
    independent: true,
    requiresReview: false,
    providerBound: false,
    hooks: ["review", "decisions"],
  },
  {
    id: "identification",
    kind: null,
    layer: "policy",
    live: true,
    independent: true,
    requiresReview: false,
    providerBound: false,
    hooks: ["identification"],
  },
  {
    id: "safety",
    kind: null,
    layer: "policy",
    live: true,
    independent: true,
    requiresReview: false,
    providerBound: false,
    hooks: ["safety"],
  },
  {
    id: "decisions",
    kind: null,
    layer: "policy",
    live: true,
    independent: true,
    requiresReview: false,
    providerBound: false,
    hooks: ["decisions"],
  },
  {
    id: "support",
    kind: "support",
    layer: "capability",
    live: true,
    independent: true,
    requiresReview: false,
    providerBound: true,
    hooks: ["safety", "identification", "decisions"],
  },
];

export function isAiModuleId(value: string): value is AiModuleId {
  return (AI_MODULE_IDS as readonly string[]).includes(value);
}

export function isAiProviderId(value: string): value is AiProviderId {
  return (AI_PROVIDER_IDS as readonly string[]).includes(value);
}

export function getAiModuleDefinition(id: AiModuleId) {
  const definition = AI_MODULES.find((item) => item.id === id);
  if (!definition) {
    throw new Error(`Unknown AI module: ${id}`);
  }
  return definition;
}

export function aiModuleForJobKind(kind: AiJobKind) {
  return AI_MODULES.find((item) => item.kind === kind) ?? null;
}

export function liveAiJobKinds() {
  return AI_MODULES.filter(
    (item): item is AiModuleDefinition & { kind: AiJobKind } =>
      Boolean(item.kind) && item.live,
  ).map((item) => item.kind);
}

export function plannedAiJobKinds() {
  return AI_JOB_KINDS.filter(
    (kind) => !AI_MODULES.some((item) => item.kind === kind && item.live),
  );
}

export function aiModuleRequiresReview(id: AiModuleId) {
  const definition = getAiModuleDefinition(id);
  if (definition.kind) return aiKindRequiresReview(definition.kind);
  return definition.requiresReview;
}
