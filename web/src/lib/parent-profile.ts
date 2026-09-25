import {
  ageFromDateOfBirth,
  formatDateOfBirth,
  parseDateOfBirth,
} from "@/lib/student-profile";

export const PARENT_REGISTER_MIN_AGE = 18;
export const PARENT_MANAGED_CHILD_MIN_AGE = 3;
export const PARENT_MANAGED_CHILD_MAX_AGE = 17;
export const MAX_CHILDREN_PER_PARENT = 12;

export const parentRelationships = [
  { value: "parent", label: "Parent" },
  { value: "guardian", label: "Guardian" },
  { value: "other", label: "Relative or carer" },
] as const;

const relationshipValues = new Set(
  parentRelationships.map((item) => item.value),
);

export function canRegisterParent(value: Date) {
  const age = ageFromDateOfBirth(value);
  return age >= PARENT_REGISTER_MIN_AGE && age <= 120;
}

export function canBeParentManagedChild(value: Date) {
  const age = ageFromDateOfBirth(value);
  return (
    age >= PARENT_MANAGED_CHILD_MIN_AGE && age <= PARENT_MANAGED_CHILD_MAX_AGE
  );
}

export function parentManagedChildAgeMessage(value: Date) {
  const age = ageFromDateOfBirth(value);
  if (age < PARENT_MANAGED_CHILD_MIN_AGE) {
    return "Children added to a family account must be at least 3 years old.";
  }
  if (age > PARENT_MANAGED_CHILD_MAX_AGE) {
    return "Adult learners 18+ should create their own student account.";
  }
  return null;
}

export function normalizeParentRelationship(value?: string | null) {
  const relationship = value?.trim().toLowerCase() ?? "";
  return relationshipValues.has(
    relationship as (typeof parentRelationships)[number]["value"],
  )
    ? relationship
    : null;
}

export function parentRelationshipLabel(value?: string | null) {
  return (
    parentRelationships.find((item) => item.value === value)?.label ?? null
  );
}

export function normalizeParentPhone(value?: string | null) {
  const phone = value?.trim() ?? "";
  if (!phone) {
    return null;
  }
  if (!/^[+0-9() .\-]{6,40}$/.test(phone)) {
    return null;
  }
  return phone;
}

export function parentProfileCompleteness(input: {
  dateOfBirth?: string | Date | null;
  relationship?: string | null;
  country?: string | null;
}) {
  const missing: string[] = [];
  if (!parseDateOfBirth(formatDateOfBirth(input.dateOfBirth ?? null))) {
    missing.push("Date of birth");
  }
  if (!normalizeParentRelationship(input.relationship)) {
    missing.push("Relationship");
  }
  if (!input.country?.trim()) {
    missing.push("Country");
  }
  return {
    ready: missing.length === 0,
    missing,
  };
}
