export const PLAN_CATALOG = {
  free: {
    name: "Free",
    amount: 0,
    description: "All current modules, with monthly usage limits.",
    recordLimit: 30,
    memberLimit: 1,
  },
  premium: {
    name: "Premium",
    amount: 4500,
    description: "Unlimited monthly records for a growing business.",
    recordLimit: null,
    memberLimit: 1,
  },
  enterprise: {
    name: "Enterprise",
    amount: 9000,
    description: "Unlimited monthly records and team access.",
    recordLimit: null,
    memberLimit: 10,
  },
  standard_x: {
    name: "Standard X",
    amount: 15000,
    description: "Unlimited monthly entries for a growing business.",
    recordLimit: null,
    memberLimit: 1,
  },
} as const;

export type PaidPlan = "premium" | "enterprise" | "standard_x";
export type PlanName = keyof typeof PLAN_CATALOG;

export function isPaidPlan(value: unknown): value is PaidPlan {
  return (
    value === "premium" ||
    value === "enterprise" ||
    value === "standard_x"
  );
}

export const BILLABLE_RECORDS = [
  "sales",
  "expenses",
  "invoices",
  "products",
  "customers",
] as const;
