import { getIntegrationStatus } from "@/server/integrations/registry";
import type { PaymentsProviderId } from "@/lib/payments-finance";

export type PaymentsAdapterStatus = {
  id: PaymentsProviderId;
  configured: boolean;
  purpose: string;
};

export function getPaymentsAdapter(): PaymentsAdapterStatus {
  const payments = getIntegrationStatus().find((item) => item.key === "payments");
  return {
    id: payments?.configured ? "stripe" : "manual",
    configured: Boolean(payments?.configured),
    purpose: "Checkout, refunds, and payment confirmation",
  };
}

export function getPayoutsAdapter(): PaymentsAdapterStatus {
  const payouts = getIntegrationStatus().find((item) => item.key === "payouts");
  return {
    id: payouts?.configured ? "stripe" : "manual",
    configured: Boolean(payouts?.configured),
    purpose: "Teacher payouts and connected accounts",
  };
}

export function listPaymentsAdapters() {
  return {
    payments: getPaymentsAdapter(),
    payouts: getPayoutsAdapter(),
  };
}
