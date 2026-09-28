import {
  AI_MODULES,
  AI_SHARED_HOOKS,
  getAiModuleDefinition,
  type AiModuleDefinition,
  type AiModuleId,
  type AiSharedHook,
} from "@/lib/ai-modules";
import { ApiError } from "@/server/api/errors";
import {
  activeAiProviderId,
  listAiProviders,
  type AiProviderView,
} from "@/server/ai/adapter";
import type { AiJobKind } from "@/lib/ai-systems";

export type AiDeskAction =
  | "transcribe"
  | "save_text"
  | "save_speech"
  | "relabel"
  | "review"
  | "summarise"
  | "save_summary"
  | "save_key_points"
  | "save_vocabulary"
  | "save_improvement_areas"
  | "save_next_recommendations"
  | "save_notes"
  | "save_typed_notes"
  | "update_notes"
  | "generate_homework"
  | "save_typed_homework"
  | "update_homework"
  | "generate_quiz_lesson"
  | "generate_quiz_book"
  | "generate_quiz_topic"
  | "generate_quiz_upload"
  | "generate_quiz_previous"
  | "save_typed_quiz"
  | "update_quiz"
  | "generate_recommendation"
  | "generate_recommendation_previous"
  | "save_typed_recommendation"
  | "update_recommendation"
  | "ask_support";

export const AI_ACTION_MODULES: Record<AiDeskAction, AiModuleId> = {
  transcribe: "transcription",
  save_text: "transcription",
  save_speech: "transcription",
  relabel: "transcription",
  review: "review",
  summarise: "summary",
  save_summary: "summary",
  save_key_points: "summary",
  save_vocabulary: "summary",
  save_improvement_areas: "summary",
  save_next_recommendations: "summary",
  save_notes: "notes",
  save_typed_notes: "notes",
  update_notes: "notes",
  generate_homework: "homework",
  save_typed_homework: "homework",
  update_homework: "homework",
  generate_quiz_lesson: "quiz",
  generate_quiz_book: "quiz",
  generate_quiz_topic: "quiz",
  generate_quiz_upload: "quiz",
  generate_quiz_previous: "quiz",
  save_typed_quiz: "quiz",
  update_quiz: "quiz",
  generate_recommendation: "recommendation",
  generate_recommendation_previous: "recommendation",
  save_typed_recommendation: "recommendation",
  update_recommendation: "recommendation",
  ask_support: "support",
};

export type AiModuleView = {
  id: AiModuleId;
  kind: AiJobKind | null;
  live: boolean;
  independent: boolean;
  requiresReview: boolean;
  providerBound: boolean;
  hooks: AiSharedHook[];
  layer: AiModuleDefinition["layer"];
};

export type AiArchitectureView = {
  live: true;
  serverOnly: true;
  browserKeys: false;
  independentModules: true;
  sharedHooks: AiSharedHook[];
  activeProvider: ReturnType<typeof activeAiProviderId>;
  providers: AiProviderView[];
  modules: AiModuleView[];
};

function toModuleView(definition: AiModuleDefinition): AiModuleView {
  return {
    id: definition.id,
    kind: definition.kind,
    live: definition.live,
    independent: definition.independent,
    requiresReview: definition.requiresReview,
    providerBound: definition.providerBound,
    hooks: [...definition.hooks],
    layer: definition.layer,
  };
}

export function listAiModules() {
  return AI_MODULES.map(toModuleView);
}

export function listLiveAiCapabilityModules() {
  return listAiModules().filter(
    (item): item is AiModuleView & { kind: AiJobKind } =>
      Boolean(item.kind) && item.live,
  );
}

export function listPlannedAiModules() {
  return listAiModules().filter((item) => !item.live);
}

export function getAiArchitecture(): AiArchitectureView {
  return {
    live: true,
    serverOnly: true,
    browserKeys: false,
    independentModules: true,
    sharedHooks: [...AI_SHARED_HOOKS],
    activeProvider: activeAiProviderId(),
    providers: listAiProviders(),
    modules: listAiModules(),
  };
}

export function assertAiModuleLive(id: AiModuleId) {
  const definition = getAiModuleDefinition(id);
  if (!definition.live) {
    throw new ApiError(
      503,
      "AI_MODULE_PLANNED",
      `${id} is not live yet`,
    );
  }
  return definition;
}

export function assertAiActionModule(action: string) {
  const id = AI_ACTION_MODULES[action as AiDeskAction];
  if (!id) {
    throw new ApiError(400, "VALIDATION", "Unknown AI action");
  }
  return assertAiModuleLive(id);
}
