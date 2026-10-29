import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  activateVerifiedPayment,
  verifyFlutterwaveTransaction,
} from "@/lib/billing/flutterwave";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN_CATALOG, type PaidPlan } from "@/lib/billing/plans";

export const runtime = "nodejs";

type WebhookPayload = {
  event?: string;
  data?: {
    id?: number;
    tx_ref?: string;
    payment_plan?: number;
    customer?: { email?: string };
    plan?: { id?: number };
  };
};

function hasValidSignature(received: string | null, expected: string) {
  if (!received) return false;
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return (
    receivedBytes.length === expectedBytes.length &&
    timingSafeEqual(receivedBytes, expectedBytes)
  );
}

function getPlanForProviderId(providerPlanId: number): PaidPlan | null {
  if (Number(process.env.FLW_PREMIUM_PLAN_ID) === providerPlanId) {
    return "premium";
  }
  if (Number(process.env.FLW_ENTERPRISE_PLAN_ID) === providerPlanId) {
    return "enterprise";
  }
  return null;
}

export async function POST(request: Request) {
  const webhookSecret = process.env.FLW_WEBHOOK_SECRET_HASH;
  if (!webhookSecret) {
    console.error("Flutterwave webhook rejected because FLW_WEBHOOK_SECRET_HASH is unset.");
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  }

  if (!hasValidSignature(request.headers.get("verif-hash"), webhookSecret)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  try {
    const payload = JSON.parse(await request.text()) as WebhookPayload;
    const transactionId = Number(payload.data?.id);

    if (payload.event === "charge.completed" && Number.isSafeInteger(transactionId)) {
      const transaction = await verifyFlutterwaveTransaction(transactionId);
      if (transaction.status !== "successful") {
        return NextResponse.json({ received: true });
      }

      const admin = createAdminClient();
      const txRef = transaction.tx_ref || payload.data?.tx_ref || null;
      if (txRef) {
        const { data: session, error: sessionError } = await admin
          .from("billing_checkout_sessions")
          .select("business_id, plan, expected_amount, status")
          .eq("tx_ref", txRef)
          .maybeSingle();

        if (sessionError) throw sessionError;
        if (session && session.status !== "completed") {
          if (session.plan !== "premium" && session.plan !== "enterprise") {
            return NextResponse.json({ received: true });
          }

          const providerPlanId =
            session.plan === "premium"
              ? Number(process.env.FLW_PREMIUM_PLAN_ID)
              : Number(process.env.FLW_ENTERPRISE_PLAN_ID);

          if (
            transaction.currency === "NGN" &&
            transaction.amount >= session.expected_amount
          ) {
            await activateVerifiedPayment({
              transaction,
              businessId: session.business_id,
              plan: session.plan as PaidPlan,
              txRef,
              providerPlanId,
            });
          }
          return NextResponse.json({ received: true });
        }
      }

      const eventPlanId = Number(
        transaction.payment_plan ?? payload.data?.payment_plan
      );
      const customerEmail = transaction.customer?.email?.toLowerCase();

      if (!customerEmail) {
        return NextResponse.json({ received: true });
      }

      const { data: subscriptions, error: subscriptionError } = await admin
        .from("business_subscriptions")
        .select("business_id, plan, provider_payment_plan_id")
        .eq("provider_customer_email", customerEmail)
        .eq("status", "active")
        .limit(2);

      if (subscriptionError) throw subscriptionError;
      if (subscriptions?.length === 1) {
        const subscription = subscriptions[0];
        const providerPlanId = Number(subscription.provider_payment_plan_id);
        const plan = getPlanForProviderId(providerPlanId);

        if (
          !plan ||
          (Number.isSafeInteger(eventPlanId) &&
            eventPlanId > 0 &&
            eventPlanId !== providerPlanId)
        ) {
          return NextResponse.json({ received: true });
        }
        if (
          transaction.currency !== "NGN" ||
          transaction.amount < PLAN_CATALOG[plan].amount
        ) {
          return NextResponse.json(
            { error: "Payment amount did not match." },
            { status: 400 }
          );
        }

        await activateVerifiedPayment({
          transaction,
          businessId: subscription.business_id,
          plan,
          txRef: null,
          providerPlanId,
        });
      }
    } else if (payload.event === "subscription.cancelled") {
      const admin = createAdminClient();
      const providerPlanId = Number(payload.data?.plan?.id);
      const customerEmail = payload.data?.customer?.email?.toLowerCase();

      if (providerPlanId && customerEmail) {
        const { error } = await admin
          .from("business_subscriptions")
          .update({ cancel_at_period_end: true })
          .eq("provider_customer_email", customerEmail)
          .eq("provider_payment_plan_id", providerPlanId)
          .eq("status", "active");

        if (error) throw error;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Could not process Flutterwave webhook:", error);
    return NextResponse.json(
      { error: "Could not process Flutterwave webhook." },
      { status: 500 }
    );
  }
}
