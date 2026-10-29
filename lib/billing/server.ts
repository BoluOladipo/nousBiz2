import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getOwnedBusiness() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return { user: null, businessId: null, error: "unauthenticated" as const };

  const { data: membership, error: membershipError } = await supabase
    .from("business_members")
    .select("business_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) throw membershipError;
  if (!membership) return { user, businessId: null, error: "no_business" as const };
  if (membership.role !== "owner") {
    return { user, businessId: membership.business_id, error: "not_owner" as const };
  }

  return { user, businessId: membership.business_id, error: null };
}

export async function getActiveSubscription(businessId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("business_subscriptions")
    .select("plan, status, current_period_end, cancel_at_period_end")
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) throw error;

  if (
    !data ||
    data.status !== "active" ||
    (data.current_period_end &&
      new Date(data.current_period_end).getTime() <= Date.now())
  ) {
    return { plan: "free" as const, currentPeriodEnd: null, cancelAtPeriodEnd: false };
  }

  return {
    plan: data.plan as "premium" | "enterprise" | "free",
    currentPeriodEnd: data.current_period_end as string | null,
    cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
  };
}
