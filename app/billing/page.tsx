"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PLAN_CATALOG, type PaidPlan, type PlanName } from "@/lib/billing/plans";

type TeamMember = {
  userId: string;
  email: string;
  role: string;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export default function BillingPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanName>("free");
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState<PaidPlan | null>(null);
  const [email, setEmail] = useState("");
  const [teamBusy, setTeamBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadTeam = useCallback(async () => {
    const response = await fetch("/api/team/invite", { cache: "no-store" });
    const result = (await response.json()) as {
      members?: TeamMember[];
      error?: string;
    };
    if (!response.ok) throw new Error(result.error || "Could not load team members.");
    setMembers(result.members ?? []);
  }, []);

  const loadBilling = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: membership, error: membershipError } = await supabase
        .from("business_members")
        .select("business_id, role")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (membershipError) throw membershipError;
      if (!membership) {
        router.replace("/onboarding/business");
        return;
      }

      setBusinessId(membership.business_id);
      setIsOwner(membership.role === "owner");

      const { data: subscription, error: subscriptionError } = await supabase
        .from("business_subscriptions")
        .select("plan, status, current_period_end, cancel_at_period_end")
        .eq("business_id", membership.business_id)
        .maybeSingle();

      if (subscriptionError) throw subscriptionError;

      const subscriptionIsActive =
        subscription?.status === "active" &&
        (!subscription.current_period_end ||
          new Date(subscription.current_period_end).getTime() > Date.now());
      const currentPlan =
        subscriptionIsActive &&
        (subscription.plan === "premium" || subscription.plan === "enterprise")
          ? subscription.plan
          : "free";

      setPlan(currentPlan);
      setPeriodEnd(subscriptionIsActive ? subscription.current_period_end : null);
      setCancelAtPeriodEnd(
        subscriptionIsActive && Boolean(subscription.cancel_at_period_end)
      );

      if (membership.role === "owner") {
        await loadTeam();
      } else {
        setMembers([]);
      }

      const checkoutState = new URLSearchParams(window.location.search).get(
        "checkout"
      );
      if (checkoutState === "success") {
        setNotice("Your subscription is active. Thank you for upgrading.");
      } else if (checkoutState === "failed") {
        setError("Payment could not be verified. Your plan has not changed.");
      }
    } catch (loadError) {
      console.error("Could not load billing information:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load billing information."
      );
    } finally {
      setLoading(false);
    }
  }, [loadTeam, router, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBilling();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadBilling]);

  async function startCheckout(selectedPlan: PaidPlan) {
    setError("");
    setNotice("");
    setBusyPlan(selectedPlan);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan }),
      });
      const result = (await response.json()) as {
        checkoutUrl?: string;
        error?: string;
      };

      if (!response.ok || !result.checkoutUrl) {
        throw new Error(result.error || "Could not start checkout.");
      }

      window.location.assign(result.checkoutUrl);
    } catch (checkoutError) {
      console.error("Could not start subscription checkout:", checkoutError);
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Could not start checkout."
      );
      setBusyPlan(null);
    }
  }

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setTeamBusy(true);

    try {
      const response = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) throw new Error(result.error || "Could not add team member.");
      setEmail("");
      setNotice(result.message || "Team member added.");
      await loadTeam();
    } catch (inviteError) {
      console.error("Could not add team member:", inviteError);
      setError(
        inviteError instanceof Error
          ? inviteError.message
          : "Could not add team member."
      );
    } finally {
      setTeamBusy(false);
    }
  }

  async function removeMember(userId: string) {
    setError("");
    setNotice("");
    setTeamBusy(true);

    try {
      const response = await fetch(
        `/api/team/invite?userId=${encodeURIComponent(userId)}`,
        { method: "DELETE" }
      );
      const result = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) throw new Error(result.error || "Could not remove team member.");
      setNotice(result.message || "Team member removed.");
      await loadTeam();
    } catch (removeError) {
      console.error("Could not remove team member:", removeError);
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Could not remove team member."
      );
    } finally {
      setTeamBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
        <span className="ml-2 text-sm text-slate-600">Loading billing...</span>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header>
          <p className="text-sm font-semibold text-indigo-600">Subscription</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
            Plans and billing
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Choose the plan that fits your business. Paid plans renew monthly.
          </p>
        </header>

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
          >
            {notice}
          </p>
        )}

        <section
          aria-label="Available subscription plans"
          className="mt-8 grid gap-5 lg:grid-cols-3"
        >
          {(Object.entries(PLAN_CATALOG) as [PlanName, (typeof PLAN_CATALOG)[PlanName]][]).map(
            ([planKey, details]) => {
              const isCurrent = plan === planKey;
              const activePaidPlan = plan !== "free";
              const features =
                planKey === "free"
                  ? [
                      "All current modules",
                      "30 sales per calendar month",
                      "30 expenses per calendar month",
                      "30 invoices per calendar month",
                      "30 products and 30 customers per month",
                      "1 business member",
                    ]
                  : planKey === "premium"
                    ? [
                        "All current modules",
                        "Unlimited sales, expenses, and invoices",
                        "Unlimited products and customers",
                        "1 business member",
                      ]
                    : [
                        "All Premium features",
                        "Unlimited monthly records",
                        "Up to 10 business members",
                        "Enterprise team management",
                      ];

              return (
                <article
                  key={planKey}
                  className={`flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                    isCurrent
                      ? "border-indigo-500 ring-2 ring-indigo-500/10"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">
                        {details.name}
                      </h2>
                      <p className="mt-1 min-h-10 text-sm text-slate-500">
                        {details.description}
                      </p>
                    </div>
                    {isCurrent && (
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                        Current plan
                      </span>
                    )}
                  </div>

                  <p className="mt-5 text-3xl font-bold text-slate-900">
                    ₦{details.amount.toLocaleString("en-NG")}
                    <span className="ml-1 text-sm font-normal text-slate-500">
                      {details.amount ? "/ month" : "forever"}
                    </span>
                  </p>

                  <ul className="mt-6 flex-1 space-y-3">
                    {features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2.5 text-sm text-slate-700"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {planKey === "free" ? (
                    <p className="mt-7 rounded-xl bg-slate-50 px-4 py-3 text-center text-sm font-medium text-slate-600">
                      {isCurrent ? "You are on the Free plan" : "Free plan"}
                    </p>
                  ) : (
                    <button
                      type="button"
                      disabled={
                        !isOwner ||
                        Boolean(busyPlan) ||
                        activePaidPlan
                      }
                      onClick={() => void startCheckout(planKey)}
                      className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyPlan === planKey && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      {!isOwner
                        ? "Ask the business owner to upgrade"
                        : isCurrent
                          ? "Current plan"
                          : activePaidPlan
                            ? `Available after ${formatDate(periodEnd)}`
                            : `Choose ${details.name}`}
                    </button>
                  )}
                </article>
              );
            }
          )}
        </section>

        {plan !== "free" && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-900">Subscription status</h2>
            <p className="mt-2 text-sm text-slate-600">
              {cancelAtPeriodEnd
                ? `Your plan is set to end on ${formatDate(periodEnd)}.`
                : `Your ${PLAN_CATALOG[plan].name} plan is active through ${formatDate(periodEnd)}.`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Manage subscription cancellation through your Flutterwave billing emails.
            </p>
          </section>
        )}

        {isOwner &&
          businessId &&
          (plan === "enterprise" || members.length > 1) && (
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Team access
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {plan === "enterprise"
                    ? "Invite up to 10 members, including you as the owner."
                    : "Team access is limited to the business owner on this plan."}
                </p>
              </div>
              <p className="text-sm font-medium text-slate-700">
                {members.length} / {plan === "enterprise" ? 10 : 1} members
              </p>
            </div>

            {plan === "enterprise" && (
              <form
                onSubmit={inviteMember}
                className="mt-5 flex flex-col gap-3 sm:flex-row"
              >
                <label className="sr-only" htmlFor="team-member-email">
                  Team member email
                </label>
                <input
                  id="team-member-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  className="h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
                <button
                  type="submit"
                  disabled={teamBusy || members.length >= 10}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {teamBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Add team member
                </button>
              </form>
            )}

            <ul className="mt-5 divide-y divide-slate-100">
              {members.map((member) => (
                <li
                  key={member.userId}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {member.email}
                    </p>
                    <p className="text-xs capitalize text-slate-500">
                      {member.role}
                    </p>
                  </div>
                  {member.role !== "owner" && (
                    <button
                      type="button"
                      disabled={teamBusy}
                      onClick={() => void removeMember(member.userId)}
                      aria-label={`Remove ${member.email}`}
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
