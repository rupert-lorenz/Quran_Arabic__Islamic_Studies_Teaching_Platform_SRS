export type TeacherRateView = {
  amount: string;
  amountMinor?: number;
  currencyCode: string;
  formatted: string;
  studentPays: string;
  teacherEarns?: string;
  commissionAmount?: string;
  commissionPercent?: number;
  listedFormatted?: string;
  converted?: boolean;
};

const INTERNAL_TEACHER_PAYMENT_KEYS = [
  "teacherEarns",
  "teacherEarnsMinor",
  "commissionAmount",
  "commissionPercent",
  "teacherPaymentMinor",
  "teacherPaymentFormatted",
  "teacherPaymentSeriesFormatted",
] as const;

type InternalTeacherPaymentKey = (typeof INTERNAL_TEACHER_PAYMENT_KEYS)[number];

export function omitInternalTeacherPayment<T>(
  rate: T,
): T extends object ? Omit<T, InternalTeacherPaymentKey> : T {
  if (!rate || typeof rate !== "object") {
    return rate as T extends object ? Omit<T, InternalTeacherPaymentKey> : T;
  }
  const publicRate = { ...rate } as Record<string, unknown>;
  for (const key of INTERNAL_TEACHER_PAYMENT_KEYS) {
    delete publicRate[key];
  }
  return publicRate as T extends object ? Omit<T, InternalTeacherPaymentKey> : T;
}

export function splitLessonRate(amountMinor: number, commissionPercent: number) {
  const safeCommission = Math.min(100, Math.max(0, commissionPercent));
  const teacherEarnsMinor = Math.round(amountMinor * ((100 - safeCommission) / 100));
  return {
    teacherEarnsMinor,
    commissionMinor: amountMinor - teacherEarnsMinor,
  };
}

export function formatMoneyMinor(
  amountMinor: number,
  decimalPlaces: number,
  symbol: string,
) {
  if (decimalPlaces === 0) {
    return `${symbol}${amountMinor}`;
  }
  return `${symbol}${(amountMinor / 10 ** decimalPlaces).toFixed(decimalPlaces)}`;
}

export function parseMoneyMajor(value: string, decimalPlaces: number) {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }
  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > decimalPlaces) {
    return null;
  }
  const minor =
    Number(whole) * 10 ** decimalPlaces + Number(fraction.padEnd(decimalPlaces, "0") || "0");
  if (!Number.isSafeInteger(minor) || minor <= 0) {
    return null;
  }
  return minor;
}

export function previewTeacherRate(input: {
  amount: string;
  commissionPercent: number;
  currency: { code: string; symbol: string; decimalPlaces: number };
}): TeacherRateView | null {
  const amountMinor = parseMoneyMajor(input.amount, input.currency.decimalPlaces);
  if (amountMinor == null) {
    return null;
  }

  const { teacherEarnsMinor, commissionMinor } = splitLessonRate(
    amountMinor,
    input.commissionPercent,
  );
  const studentPays = formatMoneyMinor(
    amountMinor,
    input.currency.decimalPlaces,
    input.currency.symbol,
  );

  return {
    amountMinor,
    amount: (amountMinor / 10 ** input.currency.decimalPlaces).toFixed(
      input.currency.decimalPlaces,
    ),
    currencyCode: input.currency.code,
    formatted: `${studentPays} / hour`,
    studentPays,
    teacherEarns: formatMoneyMinor(
      teacherEarnsMinor,
      input.currency.decimalPlaces,
      input.currency.symbol,
    ),
    commissionAmount: formatMoneyMinor(
      commissionMinor,
      input.currency.decimalPlaces,
      input.currency.symbol,
    ),
    commissionPercent: input.commissionPercent,
  };
}
