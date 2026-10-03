export const PAYMENTS_PROVIDER_IDS = ["manual", "stripe"] as const;
export type PaymentsProviderId = (typeof PAYMENTS_PROVIDER_IDS)[number];

export const PAYMENTS_MODULE_IDS = [
  "currencies",
  "location_prices",
  "hourly",
  "single",
  "blocks",
  "subscriptions",
  "one_off",
  "courses",
  "groups",
  "wallet",
  "credit_history",
  "commission_auto",
  "commission_rules",
  "commission_scoped",
  "earnings",
  "earnings_split",
  "payouts",
  "payouts_auto",
  "refunds",
  "account_credit",
  "disputes",
  "promo",
  "referral",
] as const;
export type PaymentsModuleId = (typeof PAYMENTS_MODULE_IDS)[number];

export const PAYMENTS_MODULE_LAYERS = [
  "platform",
  "catalogue",
  "wallet",
  "commission",
  "earnings",
  "settlement",
  "planned",
] as const;
export type PaymentsModuleLayer = (typeof PAYMENTS_MODULE_LAYERS)[number];

export type PaymentsModuleDefinition = {
  id: PaymentsModuleId;
  layer: PaymentsModuleLayer;
  live: boolean;
  independent: boolean;
  staffHref?: string;
  hidesTeacherPayment: boolean;
};

export const PAYMENTS_MODULES: PaymentsModuleDefinition[] = [
  {
    id: "currencies",
    layer: "platform",
    live: true,
    independent: true,
    staffHref: "/staff/currencies",
    hidesTeacherPayment: false,
  },
  {
    id: "location_prices",
    layer: "platform",
    live: true,
    independent: true,
    staffHref: "/staff/rates",
    hidesTeacherPayment: true,
  },
  {
    id: "hourly",
    layer: "catalogue",
    live: true,
    independent: true,
    staffHref: "/staff/bookings",
    hidesTeacherPayment: true,
  },
  {
    id: "single",
    layer: "catalogue",
    live: true,
    independent: true,
    staffHref: "/staff/bookings",
    hidesTeacherPayment: true,
  },
  {
    id: "blocks",
    layer: "catalogue",
    live: true,
    independent: true,
    staffHref: "/staff/bookings",
    hidesTeacherPayment: true,
  },
  {
    id: "subscriptions",
    layer: "catalogue",
    live: true,
    independent: true,
    staffHref: "/staff/academic",
    hidesTeacherPayment: true,
  },
  {
    id: "one_off",
    layer: "catalogue",
    live: true,
    independent: true,
    staffHref: "/staff/accounts",
    hidesTeacherPayment: false,
  },
  {
    id: "courses",
    layer: "catalogue",
    live: true,
    independent: true,
    staffHref: "/live-courses/catalogue",
    hidesTeacherPayment: true,
  },
  {
    id: "groups",
    layer: "catalogue",
    live: true,
    independent: true,
    staffHref: "/staff/group-classes",
    hidesTeacherPayment: true,
  },
  {
    id: "wallet",
    layer: "wallet",
    live: true,
    independent: true,
    staffHref: "/staff/accounts",
    hidesTeacherPayment: true,
  },
  {
    id: "credit_history",
    layer: "wallet",
    live: true,
    independent: true,
    staffHref: "/staff/accounts",
    hidesTeacherPayment: true,
  },
  {
    id: "commission_auto",
    layer: "commission",
    live: true,
    independent: true,
    staffHref: "/staff/rates",
    hidesTeacherPayment: false,
  },
  {
    id: "commission_rules",
    layer: "commission",
    live: true,
    independent: true,
    staffHref: "/staff/rates",
    hidesTeacherPayment: false,
  },
  {
    id: "commission_scoped",
    layer: "commission",
    live: true,
    independent: true,
    staffHref: "/staff/rates",
    hidesTeacherPayment: false,
  },
  {
    id: "earnings",
    layer: "earnings",
    live: true,
    independent: true,
    staffHref: "/staff/accounts",
    hidesTeacherPayment: false,
  },
  {
    id: "earnings_split",
    layer: "earnings",
    live: true,
    independent: true,
    staffHref: "/staff/accounts",
    hidesTeacherPayment: false,
  },
  {
    id: "payouts",
    layer: "settlement",
    live: true,
    independent: true,
    staffHref: "/staff/accounts",
    hidesTeacherPayment: false,
  },
  {
    id: "payouts_auto",
    layer: "settlement",
    live: true,
    independent: true,
    hidesTeacherPayment: false,
  },
  {
    id: "refunds",
    layer: "settlement",
    live: true,
    independent: true,
    staffHref: "/staff/accounts",
    hidesTeacherPayment: true,
  },
  {
    id: "account_credit",
    layer: "wallet",
    live: true,
    independent: true,
    staffHref: "/staff/accounts",
    hidesTeacherPayment: true,
  },
  {
    id: "disputes",
    layer: "settlement",
    live: true,
    independent: true,
    staffHref: "/staff/accounts",
    hidesTeacherPayment: false,
  },
  {
    id: "promo",
    layer: "catalogue",
    live: true,
    independent: true,
    staffHref: "/staff/marketing",
    hidesTeacherPayment: true,
  },
  {
    id: "referral",
    layer: "catalogue",
    live: true,
    independent: true,
    staffHref: "/staff/marketing",
    hidesTeacherPayment: true,
  },
];

export function listPaymentsModules() {
  return PAYMENTS_MODULES;
}

export function paymentsModuleById(id: PaymentsModuleId) {
  return PAYMENTS_MODULES.find((item) => item.id === id) ?? null;
}
