import { ApiError } from "@/server/api/errors";

export function requireHumanSensitiveDecision(
  source: "human" | "ai" = "human",
) {
  if (source === "ai") {
    throw new ApiError(
      422,
      "AI_SAFETY",
      "AI cannot take this academic or safeguarding decision",
    );
  }
}
