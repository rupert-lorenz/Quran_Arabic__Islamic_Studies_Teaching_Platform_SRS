import { hasAnyPermission } from "@/lib/rbac";

export const STAFF_SEARCH_MIN_LENGTH = 2;
export const STAFF_SEARCH_LIMIT = 8;

export type StaffSearchHit = {
  id: string;
  href: string;
  title: string;
  detail: string;
  badge?: string;
};

export type StaffSearchSection = {
  key: string;
  label: string;
  href: string;
  hits: StaffSearchHit[];
};

export type StaffSearchCatalogItem = {
  key: string;
  label: string;
  href: string;
  permission: string | string[];
};

export const staffSearchCatalog = [
  {
    key: "users",
    label: "Users",
    href: "/staff/users",
    permission: "users.read",
  },
  {
    key: "teachers",
    label: "Teachers",
    href: "/staff/teachers",
    permission: ["teachers.approve", "teachers.documents.review"],
  },
  {
    key: "reviews",
    label: "Reviews",
    href: "/staff/reviews",
    permission: ["reviews.moderate", "teachers.approve"],
  },
  {
    key: "lessons",
    label: "Lessons",
    href: "/staff/lessons",
    permission: ["classes.manage", "students.manage"],
  },
  {
    key: "group-classes",
    label: "Group classes",
    href: "/staff/group-classes",
    permission: "classes.manage",
  },
  {
    key: "finance",
    label: "Finance",
    href: "/staff/accounts",
    permission: "payments.read",
  },
  {
    key: "campaigns",
    label: "Campaigns",
    href: "/staff/marketing",
    permission: "marketing.campaigns",
  },
  {
    key: "academic",
    label: "Academic",
    href: "/staff/academic",
    permission: ["academic.curriculum", "academic.certificates"],
  },
  {
    key: "countries",
    label: "Countries",
    href: "/staff/countries",
    permission: "settings.write",
  },
  {
    key: "currencies",
    label: "Currencies",
    href: "/staff/currencies",
    permission: ["settings.write", "payments.read"],
  },
  {
    key: "languages",
    label: "Languages",
    href: "/staff/languages",
    permission: ["settings.write", "cms.write"],
  },
  {
    key: "content",
    label: "Content",
    href: "/staff/content",
    permission: "cms.write",
  },
  {
    key: "seo",
    label: "SEO",
    href: "/staff/seo",
    permission: ["settings.write", "cms.write"],
  },
  {
    key: "brand",
    label: "Classroom brand",
    href: "/staff/brand",
    permission: "settings.write",
  },
  {
    key: "incidents",
    label: "Incidents",
    href: "/staff/safeguarding",
    permission: "safeguarding.incidents",
  },
  {
    key: "recordings",
    label: "Recordings",
    href: "/staff/safeguarding",
    permission: "safeguarding.recordings",
  },
] as const satisfies readonly StaffSearchCatalogItem[];

export type StaffSearchResult = {
  query: string;
  tooShort: boolean;
  sections: StaffSearchSection[];
  catalog: StaffSearchCatalogItem[];
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeStaffSearchQuery(value?: string | null) {
  return value?.trim().replace(/\s+/g, " ").slice(0, 120) ?? "";
}

export function parseStaffSearchUuid(value: string) {
  return uuidPattern.test(value) ? value.toLowerCase() : null;
}

export function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function staffSearchPattern(value: string) {
  return `%${escapeLikePattern(value)}%`;
}

export function visibleStaffSearchCatalog(actor: {
  roleKey: string;
  permissions: string[];
}) {
  return staffSearchCatalog.filter((item) =>
    hasAnyPermission(actor, item.permission),
  );
}
