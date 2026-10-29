import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  CircleDollarSign,
  Receipt,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import PeriodSelector, {
  type DashboardPeriod,
} from "./period-selector";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const supabase = await createClient();
  const { period: requestedPeriod } = await searchParams;
  const period: DashboardPeriod =
    requestedPeriod === "last-month" || requestedPeriod === "this-year"
      ? requestedPeriod
      : "this-month";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("business_members")
    .select("business_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw new Error(`Could not load your business membership: ${membershipError.message}`);
  }

  if (!membership) {
    redirect("/onboarding/business");
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, name, business_type, currency")
    .eq("id", membership.business_id)
    .single();

  if (businessError) {
    throw new Error(`Could not load your business: ${businessError.message}`);
  }

  if (!business) {
    throw new Error("Your business membership exists, but its business record could not be found.");
  }

  const now = new Date();
  const currentMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );
  const start =
    period === "last-month"
      ? new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)
        )
      : period === "this-year"
        ? new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
        : currentMonthStart;
  const end =
    period === "last-month" || period === "this-month"
      ? new Date(
          Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)
        )
      : new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);
  const periodLabel =
    period === "this-year"
      ? String(start.getUTCFullYear())
      : new Intl.DateTimeFormat("en-NG", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(start);

  const [
    { data: sales, error: salesError },
    { data: expenses, error: expensesError },
  ] = await Promise.all([
    supabase
      .from("sales")
      .select("total")
      .eq("business_id", business.id)
      .gte("sold_at", start.toISOString())
      .lt("sold_at", end.toISOString()),
    supabase
      .from("expenses")
      .select("amount")
      .eq("business_id", business.id)
      .gte("expense_date", startDate)
      .lt("expense_date", endDate),
  ]);

  if (salesError) {
    throw new Error(`Could not load dashboard sales: ${salesError.message}`);
  }
  if (expensesError) {
    throw new Error(`Could not load dashboard expenses: ${expensesError.message}`);
  }

  const revenue = (sales ?? []).reduce(
    (total, sale) => total + Number(sale.total),
    0
  );
  const expenseTotal = (expenses ?? []).reduce(
    (total, expense) => total + Number(expense.amount),
    0
  );
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: business.currency || "NGN",
      maximumFractionDigits: 0,
    }).format(amount);

  const fullName =
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "there";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="flex">
        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            {/* Heading */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-medium text-indigo-600">
                  {business.name}
                </p>

                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                  Good morning, {fullName}
                </h1>

                <p className="mt-2 text-sm text-slate-500">
                  Here&apos;s what&apos;s happening with your business.
                </p>
              </div>

              <PeriodSelector period={period} />
            </div>

            {/* KPIs */}
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <DashboardCard
                title="Revenue"
                value={formatCurrency(revenue)}
                description={periodLabel}
                icon={<CircleDollarSign className="h-5 w-5" />}
              />

              <DashboardCard
                title="Expenses"
                value={formatCurrency(expenseTotal)}
                description={periodLabel}
                icon={<Receipt className="h-5 w-5" />}
              />

              <DashboardCard
                title="Estimated Profit"
                value={formatCurrency(revenue - expenseTotal)}
                description={periodLabel}
                icon={<TrendingUp className="h-5 w-5" />}
              />

              <DashboardCard
                title="Sales"
                value={String(sales?.length ?? 0)}
                description={periodLabel}
                icon={<ShoppingCart className="h-5 w-5" />}
              />
            </div>

            {/* Main sections */}
            <div className="mt-6 grid gap-6 xl:grid-cols-3">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 xl:col-span-2">
                <div>
                  <h2 className="font-semibold text-slate-900">
                    Sales overview
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Your sales performance will appear here.
                  </p>
                </div>

                <div className="mt-6 flex h-64 items-center justify-center rounded-xl bg-slate-50">
                  <p className="text-sm text-slate-400">
                    Sales data will appear here
                  </p>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <h2 className="font-semibold text-slate-900">
                  NousBiz Insights
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Helpful information about your business.
                </p>

                <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                  <p className="text-sm font-medium text-indigo-900">
                    Your workspace is ready.
                  </p>

                  <p className="mt-1 text-sm leading-5 text-indigo-700">
                    Add your first product or service to start managing your
                    business.
                  </p>
                </div>
              </section>
            </div>

            {/* Recent activity */}
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <h2 className="font-semibold text-slate-900">
                Recent activity
              </h2>

              <div className="mt-5 flex min-h-32 items-center justify-center rounded-xl bg-slate-50">
                <p className="text-sm text-slate-400">
                  No business activity yet.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function DashboardCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>

          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          {icon}
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-400">{description}</p>
    </div>
  );
}