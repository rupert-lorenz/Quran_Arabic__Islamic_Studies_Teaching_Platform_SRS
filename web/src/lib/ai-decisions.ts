export const AI_FORBIDDEN_AUTONOMOUS_DECISIONS = [
  "award_mark",
  "change_grade",
  "pass_fail",
  "issue_certificate",
  "revoke_certificate",
  "update_official_progress",
  "open_safeguarding_incident",
  "close_safeguarding_incident",
  "escalate_safeguarding",
  "suspend_account",
] as const;
export type AiForbiddenDecision = (typeof AI_FORBIDDEN_AUTONOMOUS_DECISIONS)[number];

export type AiSensitiveDecisionScan = {
  academicBlocked: boolean;
  safeguardingBlocked: boolean;
  kinds: AiForbiddenDecision[];
};

const ACADEMIC_DECISION: Array<{ kind: AiForbiddenDecision; pattern: RegExp }> = [
  {
    kind: "award_mark",
    pattern:
      /\b(award|set|give|change|enter|record|update)\s+(the\s+)?((student|learner)'?s\s+)?(final\s+)?(official\s+)?(mark|grade|score)\b/i,
  },
  {
    kind: "award_mark",
    pattern: /\b(official|final)\s+(mark|grade|score|result)\b/i,
  },
  {
    kind: "award_mark",
    pattern: /منح\s+(درجة|علامة)/,
  },
  {
    kind: "change_grade",
    pattern: /تعديل\s+(ال)?(درجة|علامة)/,
  },
  {
    kind: "pass_fail",
    pattern: /\b(pass|fail)\s+(this|the)\s+(student|learner)\b/i,
  },
  {
    kind: "pass_fail",
    pattern: /\b(this|the)\s+(student|learner)\s+(has\s+)?(passed|failed)\b/i,
  },
  {
    kind: "pass_fail",
    pattern: /(ناجح|راسب)\s+هذا\s+(الطالب|المتعلم)/,
  },
  {
    kind: "issue_certificate",
    pattern: /\b(award|issue|generate)\s+(them\s+)?(a\s+|the\s+)?certificate\b/i,
  },
  {
    kind: "issue_certificate",
    pattern: /إصدار\s+شهادة/,
  },
  {
    kind: "revoke_certificate",
    pattern: /\b(revoke|withdraw)\s+(the\s+|a\s+)?certificate\b/i,
  },
  {
    kind: "revoke_certificate",
    pattern: /سحب\s+شهادة/,
  },
  {
    kind: "update_official_progress",
    pattern: /\b(official)\s+(hifdh|qur'?an|arabic|islamic studies)\s+(progress|record|decision)\b/i,
  },
  {
    kind: "update_official_progress",
    pattern: /تحديث\s+(التقدم|الحفظ)\s+(الرسمي|المعتمد)/,
  },
];

const SAFEGUARDING_DECISION: Array<{ kind: AiForbiddenDecision; pattern: RegExp }> = [
  {
    kind: "open_safeguarding_incident",
    pattern:
      /\b(open|file|raise)\s+(the\s+|a\s+)?(safeguarding\s+)?(incident|case|referral)\b/i,
  },
  {
    kind: "open_safeguarding_incident",
    pattern: /فتح\s+(بلاغ|حادث)\s+حماية/,
  },
  {
    kind: "close_safeguarding_incident",
    pattern:
      /\b(close|dismiss|resolve)\s+(the\s+|a\s+)?(safeguarding\s+)?(incident|case|referral)\b/i,
  },
  {
    kind: "close_safeguarding_incident",
    pattern: /إغلاق\s+(بلاغ|حادث)\s+حماية/,
  },
  {
    kind: "escalate_safeguarding",
    pattern: /\b(escalate)\s+(the\s+|a\s+)?(safeguarding\s+)?(incident|case|referral)\b/i,
  },
  {
    kind: "escalate_safeguarding",
    pattern: /\bmake\s+a\s+safeguarding\s+decision\b/i,
  },
  {
    kind: "escalate_safeguarding",
    pattern: /تصعيد\s+(بلاغ|حادث)\s+حماية/,
  },
  {
    kind: "suspend_account",
    pattern: /\b(suspend|restrict|ban)\s+(this\s+)?(student|teacher|account)\b/i,
  },
  {
    kind: "suspend_account",
    pattern: /إيقاف\s+(حساب|الطالب|المعلم)/,
  },
];

const SKIP_PAYLOAD_KEYS = new Set([
  "origin",
  "controls",
  "safety",
  "decisions",
  "engine",
  "language",
  "recognition",
  "source",
  "sourceType",
  "transcriptJobId",
  "materialId",
  "previousClassroomId",
  "recordingId",
  "speakerCount",
  "identifiedSpeakerCount",
  "contactFiltered",
  "autonomousDecisions",
  "generatedByAi",
]);

export function scanAiSensitiveDecision(text: string): AiSensitiveDecisionScan {
  const value = text.trim();
  if (!value) {
    return { academicBlocked: false, safeguardingBlocked: false, kinds: [] };
  }
  const kinds = new Set<AiForbiddenDecision>();
  for (const item of ACADEMIC_DECISION) {
    if (item.pattern.test(value)) kinds.add(item.kind);
  }
  for (const item of SAFEGUARDING_DECISION) {
    if (item.pattern.test(value)) kinds.add(item.kind);
  }
  const list = [...kinds];
  return {
    academicBlocked: list.some((kind) =>
      [
        "award_mark",
        "change_grade",
        "pass_fail",
        "issue_certificate",
        "revoke_certificate",
        "update_official_progress",
      ].includes(kind),
    ),
    safeguardingBlocked: list.some((kind) =>
      [
        "open_safeguarding_incident",
        "close_safeguarding_incident",
        "escalate_safeguarding",
        "suspend_account",
      ].includes(kind),
    ),
    kinds: list,
  };
}

export function aiDecisionRefusal(scan: {
  academicBlocked: boolean;
  safeguardingBlocked: boolean;
}) {
  if (scan.safeguardingBlocked) {
    return "AI cannot open, close, or decide safeguarding incidents";
  }
  if (scan.academicBlocked) {
    return "AI cannot award marks, issue certificates, or update official progress";
  }
  return null;
}

export function refuseAutonomousSensitiveDecision(text: string) {
  return aiDecisionRefusal(scanAiSensitiveDecision(text));
}

export function collectDecisionScanText(value: unknown): string {
  const parts: string[] = [];
  flattenDecisionText(value, parts);
  return parts.join("\n");
}

function flattenDecisionText(value: unknown, into: string[], key?: string) {
  if (key && SKIP_PAYLOAD_KEYS.has(key)) return;
  if (typeof value === "string") {
    if (value.trim()) into.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) flattenDecisionText(item, into);
    return;
  }
  if (value && typeof value === "object") {
    for (const [nextKey, item] of Object.entries(value)) {
      flattenDecisionText(item, into, nextKey);
    }
  }
}

export function aiDecisionPayload() {
  return {
    autonomous: false,
    applied: [] as AiForbiddenDecision[],
    forbidden: [...AI_FORBIDDEN_AUTONOMOUS_DECISIONS],
  };
}
