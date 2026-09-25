export type PricingControlScope = "country" | "subject" | "teacher";

export type PricingControlRule = {
  id?: string;
  scope: PricingControlScope;
  scopeKey: string;
  minMinor: number | null;
  maxMinor: number | null;
};

export type PricingControlSource = {
  scope: "platform" | PricingControlScope;
  scopeKey: string;
  label: string;
  appliesMin: boolean;
  appliesMax: boolean;
};

export type EffectiveRateBand = {
  minMinor: number;
  maxMinor: number;
  sources: PricingControlSource[];
  conflict: boolean;
  teacherOverride: boolean;
};

export function resolveEffectiveRateBand(input: {
  platformMin: number;
  platformMax: number;
  country?: PricingControlRule | null;
  subjects?: PricingControlRule[];
  teacher?: PricingControlRule | null;
  labels?: {
    country?: string;
    subjects?: Record<string, string>;
    teacher?: string;
  };
}): EffectiveRateBand {
  let minMinor = input.platformMin;
  let maxMinor = input.platformMax;
  const sources: PricingControlSource[] = [
    {
      scope: "platform",
      scopeKey: "platform",
      label: "Platform default",
      appliesMin: true,
      appliesMax: true,
    },
  ];

  function intersect(rule: PricingControlRule, label: string) {
    if (rule.minMinor != null) {
      minMinor = Math.max(minMinor, rule.minMinor);
      sources.push({
        scope: rule.scope,
        scopeKey: rule.scopeKey,
        label,
        appliesMin: true,
        appliesMax: false,
      });
    }
    if (rule.maxMinor != null) {
      maxMinor = Math.min(maxMinor, rule.maxMinor);
      sources.push({
        scope: rule.scope,
        scopeKey: rule.scopeKey,
        label,
        appliesMin: false,
        appliesMax: true,
      });
    }
  }

  if (input.country) {
    intersect(input.country, input.labels?.country ?? input.country.scopeKey);
  }
  for (const rule of input.subjects ?? []) {
    intersect(
      rule,
      input.labels?.subjects?.[rule.scopeKey] ?? rule.scopeKey,
    );
  }

  let teacherOverride = false;
  if (input.teacher) {
    const label = input.labels?.teacher ?? "This teacher";
    if (input.teacher.minMinor != null) {
      minMinor = input.teacher.minMinor;
      teacherOverride = true;
      sources.push({
        scope: "teacher",
        scopeKey: input.teacher.scopeKey,
        label,
        appliesMin: true,
        appliesMax: false,
      });
    }
    if (input.teacher.maxMinor != null) {
      maxMinor = input.teacher.maxMinor;
      teacherOverride = true;
      sources.push({
        scope: "teacher",
        scopeKey: input.teacher.scopeKey,
        label,
        appliesMin: false,
        appliesMax: true,
      });
    }
  }

  return {
    minMinor,
    maxMinor,
    sources,
    conflict: minMinor > maxMinor,
    teacherOverride,
  };
}
