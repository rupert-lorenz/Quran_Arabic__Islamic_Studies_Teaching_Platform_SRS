export const teacherGenders = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
] as const;

export const teacherAudiences = [
  { value: "children", label: "Children" },
  { value: "teens", label: "Teens" },
  { value: "adults", label: "Adults" },
  { value: "families", label: "Families" },
] as const;

export { teacherSearchSorts } from "@/lib/teacher-ranking";

export type TeacherSearchQuery = {
  q?: string;
  subject?: string;
  language?: string;
  country?: string;
  gender?: string;
  audience?: string;
  minPrice?: string;
  maxPrice?: string;
  minRating?: string;
  video?: string;
  sort?: string;
};

export type SearchableTeacher = {
  displayName: string;
  headline?: string | null;
  bio?: string | null;
  languages?: string | null;
  country?: string | null;
  countryName?: string | null;
  subjects: { slug: string; name: string }[];
  gender?: string | null;
  audiences: string[];
  rateAmount: number | null;
  hasVideo: boolean;
  rating: number | null;
};

const audienceValues = new Set(teacherAudiences.map((item) => item.value));
const genderValues = new Set(teacherGenders.map((item) => item.value));

export function parseAudienceList(value?: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is (typeof teacherAudiences)[number]["value"] =>
      audienceValues.has(item as (typeof teacherAudiences)[number]["value"]),
    );
}

export function serializeAudienceList(values: string[]) {
  return parseAudienceList(values.join(",")).join(", ");
}

export function normalizeTeacherGender(value?: string | null) {
  const gender = value?.trim().toLowerCase() ?? "";
  return genderValues.has(gender as (typeof teacherGenders)[number]["value"])
    ? gender
    : null;
}

export function teacherGenderLabel(value?: string | null) {
  return teacherGenders.find((item) => item.value === value)?.label ?? null;
}

export function teacherAudienceLabel(value: string) {
  return teacherAudiences.find((item) => item.value === value)?.label ?? value;
}

export function formatAudienceList(values: string[]) {
  return values.map(teacherAudienceLabel).join(" · ");
}

function textValue(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed && trimmed !== "all" && trimmed !== "ALL" ? trimmed : "";
}

function numberValue(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  const amount = Number(trimmed);
  return Number.isFinite(amount) ? amount : null;
}

export function hasTeacherSearchFilters(query: TeacherSearchQuery) {
  return Boolean(
    textValue(query.q) ||
      textValue(query.subject) ||
      textValue(query.language) ||
      textValue(query.country) ||
      normalizeTeacherGender(query.gender) ||
      parseAudienceList(query.audience)[0] ||
      numberValue(query.minPrice) != null ||
      numberValue(query.maxPrice) != null ||
      numberValue(query.minRating) != null ||
      wantsVideo(query.video),
  );
}

function wantsVideo(value?: string | null) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function teacherMatchesSearch(
  teacher: SearchableTeacher,
  query: TeacherSearchQuery,
) {
  const q = textValue(query.q).toLowerCase();
  if (q) {
    const haystack = [
      teacher.displayName,
      teacher.headline,
      teacher.bio,
      teacher.languages,
      teacher.country,
      teacher.countryName,
      teacherGenderLabel(teacher.gender),
      formatAudienceList(teacher.audiences),
      ...teacher.subjects.map((item) => `${item.slug} ${item.name}`),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) {
      return false;
    }
  }

  const subject = textValue(query.subject).toLowerCase();
  if (subject && !teacher.subjects.some((item) => item.slug === subject)) {
    return false;
  }

  const language = textValue(query.language).toLowerCase();
  if (language && !(teacher.languages ?? "").toLowerCase().includes(language)) {
    return false;
  }

  const country = textValue(query.country).toUpperCase();
  if (country && teacher.country !== country) {
    return false;
  }

  const gender = normalizeTeacherGender(query.gender);
  if (gender && teacher.gender !== gender) {
    return false;
  }

  const audience = parseAudienceList(query.audience)[0];
  if (audience && !teacher.audiences.includes(audience)) {
    return false;
  }

  const minPrice = numberValue(query.minPrice);
  if (minPrice != null && (teacher.rateAmount == null || teacher.rateAmount < minPrice)) {
    return false;
  }

  const maxPrice = numberValue(query.maxPrice);
  if (maxPrice != null && (teacher.rateAmount == null || teacher.rateAmount > maxPrice)) {
    return false;
  }

  const minRating = numberValue(query.minRating);
  if (minRating != null && (teacher.rating == null || teacher.rating < minRating)) {
    return false;
  }

  if (wantsVideo(query.video) && !teacher.hasVideo) {
    return false;
  }

  return true;
}

export function describeTeacherSearchFilters(
  query: TeacherSearchQuery,
  options: {
    subjects: { slug: string; name: string }[];
    countries: { iso2: string; name: string }[];
  },
) {
  const chips: { key: string; label: string }[] = [];
  const q = textValue(query.q);
  if (q) {
    chips.push({ key: "q", label: `“${q}”` });
  }
  const subject = textValue(query.subject);
  if (subject) {
    chips.push({
      key: "subject",
      label:
        options.subjects.find((item) => item.slug === subject)?.name ?? subject,
    });
  }
  const language = textValue(query.language);
  if (language) {
    chips.push({ key: "language", label: language });
  }
  const country = textValue(query.country).toUpperCase();
  if (country) {
    chips.push({
      key: "country",
      label:
        options.countries.find((item) => item.iso2 === country)?.name ?? country,
    });
  }
  const gender = teacherGenderLabel(query.gender);
  if (gender) {
    chips.push({ key: "gender", label: gender });
  }
  const audience = parseAudienceList(query.audience)[0];
  if (audience) {
    chips.push({ key: "audience", label: teacherAudienceLabel(audience) });
  }
  const minPrice = numberValue(query.minPrice);
  const maxPrice = numberValue(query.maxPrice);
  if (minPrice != null || maxPrice != null) {
    chips.push({
      key: "price",
      label: `${minPrice ?? "Any"}–${maxPrice ?? "any"} / hour`,
    });
  }
  const minRating = numberValue(query.minRating);
  if (minRating != null) {
    chips.push({ key: "rating", label: `${minRating}+ rating` });
  }
  if (wantsVideo(query.video)) {
    chips.push({ key: "video", label: "Intro video" });
  }
  return chips;
}
