import { ApiError } from "@/server/api/errors";

export function parseOptionalMajorAmount(value: string, decimalPlaces: number) {
  if (!value.trim()) {
    return null;
  }
  return parseMajorAmount(value, decimalPlaces);
}

export function parseNonNegativeMajorAmount(value: string, decimalPlaces: number) {
  const trimmed = value.trim();
  if (!trimmed || /^0+(?:\.0+)?$/.test(trimmed)) {
    return 0;
  }
  return parseMajorAmount(value, decimalPlaces);
}

export function parseMajorAmount(value: string, decimalPlaces: number) {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new ApiError(422, "VALIDATION", "Enter a valid amount");
  }

  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > decimalPlaces) {
    throw new ApiError(
      422,
      "VALIDATION",
      `This currency allows ${decimalPlaces} decimal places`,
    );
  }

  const padded = fraction.padEnd(decimalPlaces, "0");
  const minor = Number(whole) * 10 ** decimalPlaces + Number(padded || "0");
  if (!Number.isSafeInteger(minor) || minor <= 0) {
    throw new ApiError(422, "VALIDATION", "Amount must be greater than zero");
  }

  return minor;
}

export function formatMajorAmount(amountMinor: number, decimalPlaces: number) {
  if (decimalPlaces === 0) {
    return String(amountMinor);
  }
  return (amountMinor / 10 ** decimalPlaces).toFixed(decimalPlaces);
}

export function formatMinorAmount(
  amountMinor: number,
  decimalPlaces: number,
  symbol: string,
) {
  if (decimalPlaces === 0) {
    return `${symbol}${amountMinor}`;
  }

  const factor = 10 ** decimalPlaces;
  const major = (amountMinor / factor).toFixed(decimalPlaces);
  return `${symbol}${major}`;
}
