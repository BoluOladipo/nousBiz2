import { NextResponse } from "next/server";
import { getOwnedBusiness } from "@/lib/billing/server";
import { PLAN_CATALOG, type PaidPlan } from "@/lib/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { plan?: unknown };
    if (body.plan !== "premium" && body.plan !== "enterprise") {
      return NextResponse.json({ error: "Select a valid paid plan." }, { status: 400 });
    }

    const plan = body.plan as PaidPlan;
    const planIdValue =
      plan === "premium"
        ? process.env.FLW_PREMIUM_PLAN_ID
        : process.env.FLW_ENTERPRISE_PLAN_ID;
    const appUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!process.env.FLW_SECRET_KEY || !planIdValue || !appUrl) {
      return NextResponse.json(
        {
          error:
            "Payments are not configured. Set FLW_SECRET_KEY, both Flutterwave plan IDs, and NEXT_PUBLIC_SITE_URL.",
        },
        { status: 503 }
      );
    }

    if (!/^\d+$/.test(planIdValue)) {
      return NextResponse.json(
        { error: "The configured Flutterwave payment plan ID is invalid." },
        { status: 500 }
      );
    }

    const { user, businessId, error: accountError } = await getOwnedBusiness();
    if (accountError === "unauthenticated") {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    }
    if (accountError === "no_business" || !businessId || !user) {
      return NextResponse.json(
        { error: "Create a business before choosing a subscription." },
        { status: 400 }
      );
    }
    if (accountError === "not_owner") {
      return NextResponse.json(
        { error: "Only the business owner can change the subscription." },
        { status: 403 }
      );
    }

    const txRef = `nousbiz-${crypto.randomUUID()}`;
    const planDetails = PLAN_CATALOG[plan];
    const admin = createAdminClient();
    const { data: currentSubscription, error: subscriptionError } = await admin
      .from("business_subscriptions")
      .select("status, current_period_end, cancel_at_period_end")
      .eq("business_id", businessId)
      .maybeSingle();

    if (subscriptionError) throw subscriptionError;
    if (
      currentSubscription?.status === "active" &&
      (!currentSubscription.current_period_end ||
        new Date(currentSubscription.current_period_end).getTime() > Date.now())
    ) {
      return NextResponse.json(
        {
          error:
            "Your current subscription remains active through this billing period. Choose a new plan after it ends to avoid overlapping recurring charges.",
        },
        { status: 409 }
      );
    }

    const { error: sessionError } = await admin
      .from("billing_checkout_sessions")
      .insert({
        tx_ref: txRef,
        business_id: businessId,
        user_id: user.id,
        plan,
        expected_amount: planDetails.amount,
      });

    if (sessionError) throw sessionError;

    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: planDetails.amount,
        currency: "NGN",
        redirect_url: new URL("/api/billing/verify", appUrl).toString(),
        payment_plan: Number(planIdValue),
        customer: {
          email: user.email,
          name:
            typeof user.user_metadata?.full_name === "string"
              ? user.user_metadata.full_name
              : user.email,
        },
        customizations: {
          title: "NousBiz subscription",
          description: `${planDetails.name} monthly plan`,
        },
      }),
      cache: "no-store",
    });

    const result = (await response.json()) as {
      status: string;
      message?: string;
      data?: { link?: string };
    };

    if (!response.ok || result.status !== "success" || !result.data?.link) {
      throw new Error(result.message || "Flutterwave could not start checkout.");
    }

    return NextResponse.json({ checkoutUrl: result.data.link });
  } catch (error) {
    console.error("Could not start Flutterwave checkout:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not start checkout.",
      },
      { status: 500 }
    );
  }
}
