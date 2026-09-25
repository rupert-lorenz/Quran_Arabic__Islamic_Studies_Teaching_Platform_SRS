export const staffRoles = [
  "super_admin",
  "admin",
  "accounts",
  "marketing",
  "academic",
  "safeguarding",
] as const;

export type StaffRole = (typeof staffRoles)[number];

export const staffModules = [
  {
    href: "/staff/users",
    label: "Users",
    description: "Directory of accounts and statuses",
    permission: "users.read",
  },
  {
    href: "/staff/admins",
    label: "Admins",
    description: "Configure Admin accounts and their permissions",
    permission: "rbac.write",
  },
  {
    href: "/staff/teachers",
    label: "Teachers",
    description: "Teacher applications, documents, and approvals",
    permission: ["teachers.approve", "teachers.documents.review"],
  },
  {
    href: "/staff/reviews",
    label: "Reviews",
    description: "Parent ratings and review moderation",
    permission: ["reviews.moderate", "teachers.approve"],
  },
  {
    href: "/staff/rates",
    label: "Rates",
    description: "Lesson price limits, commission, and default currency",
    permission: ["settings.write", "teachers.approve", "payments.read"],
  },
  {
    href: "/staff/countries",
    label: "Countries",
    description: "Enabled countries, timezones, and default currencies",
    permission: "settings.write",
  },
  {
    href: "/staff/currencies",
    label: "Currencies",
    description: "Enabled currencies and display FX rates",
    permission: ["settings.write", "payments.read"],
  },
  {
    href: "/staff/languages",
    label: "Languages",
    description: "Locales, RTL, and translations",
    permission: ["settings.write", "cms.write"],
  },
  {
    href: "/staff/content",
    label: "Content",
    description: "Pages, landings, policies, FAQs, articles, banners, and announcements",
    permission: "cms.write",
  },
  {
    href: "/staff/seo",
    label: "SEO",
    description: "Titles, descriptions, indexing, sitemap, and canonical URLs",
    permission: ["settings.write", "cms.write"],
  },
  {
    href: "/staff/brand",
    label: "Brand",
    description: "Classroom overlay, mark, colours, and in-lesson branding",
    permission: "settings.write",
  },
  {
    href: "/staff/accounts",
    label: "Accounts",
    description: "Payments, refunds, payouts, and finance reports",
    permission: "payments.read",
  },
  {
    href: "/staff/marketing",
    label: "Marketing",
    description: "Campaigns and promotions",
    permission: "marketing.campaigns",
  },
  {
    href: "/staff/academic",
    label: "Academic",
    description: "Curriculum, teaching library, student reports, and certificates",
    permission: "academic.curriculum",
  },
  {
    href: "/staff/bookings",
    label: "Bookings",
    description: "Lesson calendar, cancellations, and reschedules",
    permission: ["classes.manage", "teachers.approve"],
  },
  {
    href: "/staff/group-classes",
    label: "Group classes",
    description: "Post opportunities, select teachers, or create a class schedule",
    permission: "classes.manage",
  },
  {
    href: "/staff/lessons",
    label: "Lessons",
    description: "Student lesson history and recorded classes",
    permission: ["classes.manage", "students.manage"],
  },
  {
    href: "/staff/safeguarding",
    label: "Safeguarding",
    description: "Incidents and recordings",
    permission: "safeguarding.incidents",
  },
  {
    href: "/staff/roles",
    label: "Roles & permissions",
    description: "Granular access for each staff role",
    permission: "rbac.read",
  },
] as const;

export const marketplaceRoles = ["teacher", "student", "parent"] as const;

export const allRoleKeys = [...staffRoles, ...marketplaceRoles] as const;

export type RoleKey = (typeof allRoleKeys)[number];

export const dedicatedStaffRoles = [
  {
    key: "accounts",
    href: "/staff/accounts",
    label: "Accounts",
    permission: "payments.read",
    duties: [
      "Record payments",
      "Issue refunds",
      "Manage payouts",
      "Read finance reports",
    ],
  },
  {
    key: "marketing",
    href: "/staff/marketing",
    label: "Marketing",
    permission: "marketing.campaigns",
    duties: ["Run campaigns", "Write CMS content", "Read marketing reports"],
  },
  {
    key: "academic",
    href: "/staff/academic",
    label: "Academic",
    permission: "academic.curriculum",
    duties: [
      "Manage curriculum",
      "Manage the teaching material library",
      "Manage certificates",
      "Record lesson history",
      "Read academic reports",
    ],
  },
  {
    key: "safeguarding",
    href: "/staff/safeguarding",
    label: "Safeguarding",
    permission: "safeguarding.incidents",
    duties: [
      "Log incidents",
      "Review recordings",
      "Suspend involved accounts",
      "Read audit logs",
    ],
  },
] as const;

export function isStaffRole(roleKey: string) {
  return staffRoles.includes(roleKey as StaffRole);
}

export function formatRoleKey(roleKey: string) {
  return roleKey.replaceAll("_", " ");
}

export function assignableStaffRoles(actorRoleKey: string) {
  if (actorRoleKey === "super_admin") {
    return [...staffRoles];
  }
  return staffRoles.filter((role) => role !== "super_admin");
}

export function hasAnyPermission(
  actor: { roleKey: string; permissions: string[] },
  keys: string | readonly string[],
) {
  if (actor.roleKey === "super_admin") {
    return true;
  }

  const needed = Array.isArray(keys) ? keys : [keys];
  return needed.some((key) => actor.permissions.includes(key));
}
