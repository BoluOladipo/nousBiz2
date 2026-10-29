import { PLAN_CATALOG, type PaidPlan } from "@/lib/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";

type FlutterwaveTransaction = {
  id: number;
  tx_ref: string;
  status: string;
  currency: string;
  amount: number;
  payment_plan?: number;
  customer?: {
    email?: string;
  };
};

type FlutterwaveResponse = {
  status: string;
  message?: string;
  data?: FlutterwaveTransaction;
};

export async function verifyFlutterwaveTransaction(
  transactionId: number
): Promise<FlutterwaveTransaction> {
  const secretKey = process.env.FLW_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Flutterwave is not configured. Set FLW_SECRET_KEY.");
  }

  const response = await fetch(
    `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
    {
      headers: { Authorization: `Bearer ${secretKey}` },
      cache: "no-store",
    }
  );
  const result = (await response.json()) as FlutterwaveResponse;

  if (!response.ok || result.status !== "success" || !result.data) {
    throw new Error(result.message || "Flutterwave could not verify the payment.");
  }
  if (Number(result.data.id) !== transactionId) {
    throw new Error("Flutterwave returned a different transaction than requested.");
  }

  return result.data;
}

export async function activateVerifiedPayment({
  transaction,
  businessId,
  plan,
  txRef,
  providerPlanId,
}: {
  transaction: FlutterwaveTransaction;
  businessId: string;
  plan: PaidPlan;
  txRef: string | null;
  providerPlanId: number;
}) {
  const planDetails = PLAN_CATALOG[plan];
  const customerEmail = transaction.customer?.email?.trim();
  if (
    !Number.isSafeInteger(providerPlanId) ||
    providerPlanId <= 0 ||
    !customerEmail ||
    transaction.status !== "successful" ||
    transaction.currency !== "NGN" ||
    !Number.isFinite(transaction.amount) ||
    transaction.amount < planDetails.amount ||
    (transaction.payment_plan !== undefined &&
      transaction.payment_plan !== providerPlanId) ||
    (txRef && transaction.tx_ref !== txRef)
  ) {
    throw new Error("Payment details did not match the selected subscription.");
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("apply_billing_payment", {
    p_transaction_id: transaction.id,
    p_business_id: businessId,
    p_plan: plan,
    p_provider_payment_plan_id: providerPlanId,
    p_customer_email: customerEmail,
    p_tx_ref: txRef,
  });

  if (error) throw error;
}
