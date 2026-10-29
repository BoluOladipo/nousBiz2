import { NextResponse } from "next/server";
import { PLAN_CATALOG, type PaidPlan } from "@/lib/billing/plans";
import {
  activateVerifiedPayment,
  verifyFlutterwaveTransaction,
} from "@/lib/billing/flutterwave";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function billingRedirect(appUrl: string, result: "success" | "failed") {
  const destination = new URL("/billing", appUrl);
  destination.searchParams.set("checkout", result);
  return NextResponse.redirect(destination);
}

export async function GET(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!appUrl) {
    return NextResponse.json(
      { error: "Set NEXT_PUBLIC_SITE_URL to finish payment verification." },
      { status: 503 }
    );
  }

  const query = new URL(request.url).searchParams;
  const txRef = query.get("tx_ref");
  const transactionId = Number(query.get("transaction_id"));

  if (!txRef || !Number.isSafeInteger(transactionId) || transactionId <= 0) {
    return billingRedirect(appUrl, "failed");
  }

  try {
    const admin = createAdminClient();
    const { data: session, error: sessionError } = await admin
      .from("billing_checkout_sessions")
      .select("business_id, plan, expected_amount, status")
      .eq("tx_ref", txRef)
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!session) return billingRedirect(appUrl, "failed");
    if (session.status === "completed") {
      return billingRedirect(appUrl, "success");
    }
    if (session.plan !== "premium" && session.plan !== "enterprise") {
      return billingRedirect(appUrl, "failed");
    }

    const transaction = await verifyFlutterwaveTransaction(transactionId);
    const plan = session.plan as PaidPlan;
    if (
      transaction.status !== "successful" ||
      transaction.tx_ref !== txRef ||
      transaction.currency !== "NGN" ||
      transaction.amount < Math.max(session.expected_amount, PLAN_CATALOG[plan].amount)
    ) {
      const { error: updateError } = await admin
        .from("billing_checkout_sessions")
        .update({ status: "failed" })
        .eq("tx_ref", txRef)
        .eq("status", "pending");
      if (updateError) throw updateError;
      return billingRedirect(appUrl, "failed");
    }

    const providerPlanId =
      plan === "premium"
        ? Number(process.env.FLW_PREMIUM_PLAN_ID)
        : Number(process.env.FLW_ENTERPRISE_PLAN_ID);

    await activateVerifiedPayment({
      transaction,
      businessId: session.business_id,
      plan,
      txRef,
      providerPlanId,
    });

    return billingRedirect(appUrl, "success");
  } catch (error) {
    console.error("Could not verify Flutterwave checkout:", error);
    return billingRedirect(appUrl, "failed");
  }
}
