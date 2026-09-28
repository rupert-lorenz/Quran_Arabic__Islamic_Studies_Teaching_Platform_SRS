import {
  extractHomeworkDraft,
  extractImprovementAreas,
  extractKeyLearningPoints,
  extractLearningRecommendationDraft,
  extractLessonVocabulary,
  extractNextLessonRecommendations,
  extractQuizDraft,
  extractStudentNotes,
  summariseLessonTranscript,
  type AiHomeworkDraft,
  type AiLessonSummaryDraft,
  type AiLocale,
  type AiQuizDraft,
  type AiRecommendationDraft,
  type AiStudentNotesDraft,
  type AiTranscriptSegment,
} from "@/lib/ai-systems";
import {
  extractSupportAnswer,
  type AiSupportDraft,
  type AiSupportSource,
} from "@/lib/ai-support";
import {
  AI_PROVIDER_IDS,
  isAiProviderId,
  type AiProviderId,
} from "@/lib/ai-modules";
import { ApiError } from "@/server/api/errors";
import { getIntegrationStatus } from "@/server/integrations";

export type AiProviderCapability =
  | "transcription"
  | "summary"
  | "notes"
  | "homework"
  | "quiz"
  | "recommendation"
  | "support";

export type AiProviderView = {
  id: AiProviderId;
  configured: boolean;
  canGenerate: boolean;
  serverOnly: true;
  transport: "live" | "reserved";
  capabilities: Record<AiProviderCapability, boolean>;
};

export type AiTextSource = {
  fullText: string;
  segments?: AiTranscriptSegment[];
  locale: AiLocale;
};

export type AiProviderRunner = {
  id: AiProviderId;
  summarise(input: AiTextSource): AiLessonSummaryDraft;
  keyPoints(input: AiTextSource): string[];
  vocabulary(input: AiTextSource): string[];
  improvementAreas(input: AiTextSource): string[];
  nextLesson(input: AiTextSource): string[];
  notes(input: AiTextSource): AiStudentNotesDraft;
  homework(input: AiTextSource & { classroomTitle: string }): AiHomeworkDraft;
  quiz(input: AiTextSource & { title: string }): AiQuizDraft;
  recommendation(input: AiTextSource & { title: string }): AiRecommendationDraft;
  support(input: {
    query: string;
    locale: AiLocale;
    sources: AiSupportSource[];
  }): AiSupportDraft;
};

const builtinRunner: AiProviderRunner = {
  id: "builtin",
  summarise: (input) => summariseLessonTranscript(input),
  keyPoints: (input) => extractKeyLearningPoints(input),
  vocabulary: (input) => extractLessonVocabulary(input),
  improvementAreas: (input) => extractImprovementAreas(input),
  nextLesson: (input) => extractNextLessonRecommendations(input),
  notes: (input) => extractStudentNotes(input),
  homework: (input) => extractHomeworkDraft(input),
  quiz: (input) => extractQuizDraft(input),
  recommendation: (input) => extractLearningRecommendationDraft(input),
  support: (input) => extractSupportAnswer(input),
};

function envFlag(name: string) {
  return Boolean(process.env[name]?.trim());
}

function preferredProviderId(): AiProviderId {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase() ?? "";
  return isAiProviderId(raw) ? raw : "builtin";
}

function vendorConfigured(id: Exclude<AiProviderId, "builtin">) {
  if (id === "openai") return envFlag("AI_API_KEY");
  return envFlag("DEEPGRAM_API_KEY") || envFlag("AI_API_KEY");
}

export function listAiProviders(): AiProviderView[] {
  const integration = getIntegrationStatus().find((item) => item.key === "ai");
  return AI_PROVIDER_IDS.map((id) => {
    if (id === "builtin") {
      return {
        id,
        configured: true,
        canGenerate: true,
        serverOnly: true,
        transport: "live",
        capabilities: {
          transcription: true,
          summary: true,
          notes: true,
          homework: true,
          quiz: true,
          recommendation: true,
          support: true,
        },
      };
    }
    const configured = vendorConfigured(id) || Boolean(integration?.configured && id === "openai");
    return {
      id,
      configured,
      canGenerate: false,
      serverOnly: true,
      transport: "reserved",
      capabilities: {
        transcription: id === "deepgram",
        summary: id === "openai",
        notes: id === "openai",
        homework: id === "openai",
        quiz: id === "openai",
        recommendation: id === "openai",
        support: id === "openai",
      },
    };
  });
}

export function activeAiProviderId(): AiProviderId {
  const preferred = preferredProviderId();
  const listed = listAiProviders();
  const preferredView = listed.find((item) => item.id === preferred);
  if (preferredView?.canGenerate) return preferredView.id;
  return "builtin";
}

export function getAiProviderRunner(): AiProviderRunner {
  const id = activeAiProviderId();
  if (id !== "builtin") {
    throw new ApiError(
      503,
      "INTEGRATION_NOT_CONFIGURED",
      `${id} AI transport is reserved. The on-platform extractive module is the active runner.`,
    );
  }
  return builtinRunner;
}

export const runAiModule = {
  summarise: (input: AiTextSource) => getAiProviderRunner().summarise(input),
  keyPoints: (input: AiTextSource) => getAiProviderRunner().keyPoints(input),
  vocabulary: (input: AiTextSource) => getAiProviderRunner().vocabulary(input),
  improvementAreas: (input: AiTextSource) =>
    getAiProviderRunner().improvementAreas(input),
  nextLesson: (input: AiTextSource) => getAiProviderRunner().nextLesson(input),
  notes: (input: AiTextSource) => getAiProviderRunner().notes(input),
  homework: (input: AiTextSource & { classroomTitle: string }) =>
    getAiProviderRunner().homework(input),
  quiz: (input: AiTextSource & { title: string }) => getAiProviderRunner().quiz(input),
  recommendation: (input: AiTextSource & { title: string }) =>
    getAiProviderRunner().recommendation(input),
  support: (input: {
    query: string;
    locale: AiLocale;
    sources: AiSupportSource[];
  }) => getAiProviderRunner().support(input),
};
