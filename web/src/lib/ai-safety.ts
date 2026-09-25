import { classroomContainsContactDetails } from "@/lib/classroom";
import {
  aiDecisionRefusal,
  scanAiSensitiveDecision,
} from "@/lib/ai-decisions";

export const AI_SAFETY_CONTROLS = [
  "review_before_publish",
  "label_ai_origin",
  "block_contact_details",
  "hide_teacher_payment",
  "no_autonomous_marks",
  "no_autonomous_certificates",
  "no_autonomous_safeguarding",
  "extractive_only",
] as const;
export type AiSafetyControl = (typeof AI_SAFETY_CONTROLS)[number];

export type AiSafetyScan = {
  contactBlocked: boolean;
  academicBlocked: boolean;
  safeguardingBlocked: boolean;
  paymentBlocked: boolean;
};

const PAYMENT = [
  /\b(hourly rate|teacher pay|teacher payment|bank account|sort code|iban)\b/i,
  /أجر\s+المعلم/,
];

export function scanAiSafety(text: string): AiSafetyScan {
  const value = text.trim();
  if (!value) {
    return {
      contactBlocked: false,
      academicBlocked: false,
      safeguardingBlocked: false,
      paymentBlocked: false,
    };
  }
  const decisions = scanAiSensitiveDecision(value);
  return {
    contactBlocked: classroomContainsContactDetails(value),
    academicBlocked: decisions.academicBlocked,
    safeguardingBlocked: decisions.safeguardingBlocked,
    paymentBlocked: PAYMENT.some((pattern) => pattern.test(value)),
  };
}

export function aiSafetyRefusal(scan: AiSafetyScan) {
  const decision = aiDecisionRefusal(scan);
  if (decision) return decision;
  if (scan.paymentBlocked) {
    return "Teacher payment stays out of AI text";
  }
  if (scan.contactBlocked) {
    return "Keep phone numbers and personal accounts out of AI text";
  }
  return null;
}

export function filterAiContactText(text: string) {
  const lines = text.replace(/\r/g, "").split("\n");
  let filtered = false;
  const kept: string[] = [];
  for (const line of lines) {
    if (classroomContainsContactDetails(line)) {
      filtered = true;
      continue;
    }
    kept.push(line);
  }
  return {
    text: kept.join("\n").replace(/[ \t]+\n/g, "\n").trim(),
    filtered,
  };
}

export function prepareAiSafeText(
  text: string,
  mode: "reject" | "filter",
):
  | { ok: true; text: string; filtered: boolean; scan: AiSafetyScan }
  | { ok: false; reason: string; scan: AiSafetyScan } {
  const scan = scanAiSafety(text);
  if (scan.safeguardingBlocked || scan.academicBlocked || scan.paymentBlocked) {
    return { ok: false, reason: aiSafetyRefusal(scan) ?? "AI safety blocked this text", scan };
  }
  if (scan.contactBlocked && mode === "reject") {
    return { ok: false, reason: aiSafetyRefusal(scan) ?? "AI safety blocked this text", scan };
  }
  if (scan.contactBlocked && mode === "filter") {
    const next = filterAiContactText(text);
    return { ok: true, text: next.text, filtered: next.filtered, scan };
  }
  return { ok: true, text, filtered: false, scan };
}

export function aiSafetyPayload(filtered: boolean) {
  return {
    contactFiltered: filtered,
    autonomousDecisions: false,
    controls: [...AI_SAFETY_CONTROLS],
  };
}
