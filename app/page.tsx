import Link from "next/link";
import BrandLogo from "./brand-logo";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  FileText,
  Receipt,
  Users,
  Wallet,
} from "lucide-react";
import { PLAN_CATALOG } from "@/lib/billing/plans";

const features = [
  {
    icon: Receipt,
    title: "Track sales",
    description:
      "Record every sale, monitor revenue, and keep your transactions organized.",
  },
  {
    icon: Wallet,
    title: "Manage expenses",
    description:
      "Know where your money goes and keep your business spending under control.",
  },
  {
    icon: Boxes,
    title: "Monitor inventory",
    description:
      "Keep track of stock levels and know when products need your attention.",
  },
  {
    icon: Users,
    title: "Manage customers",
    description:
      "Keep customer information, purchases, and relationships organized.",
  },
  {
    icon: FileText,
    title: "Create invoices",
    description:
      "Create professional invoices and keep track of what customers owe.",
  },
  {
    icon: BarChart3,
    title: "Understand your business",
    description:
      "Turn your business activity into clear reports and useful insights.",
  },
];

const businessTypes = [
  "Retail & Wholesale",
  "Restaurants & Food",
  "Fashion",
  "Beauty & Barber",
  "Freelancers",
  "Professional Services",
  "Logistics",
  "Technology",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-[#111827]">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-[#E5E7EB]/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <BrandLogo className="h-9 w-auto" />
            <span className="text-xl font-bold tracking-tight">
              NousBiz
            </span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <Link
              href="#features"
              className="text-sm font-medium text-[#6B7280] transition hover:text-[#111827]"
            >
              Features
            </Link>

            <Link
              href="#businesses"
              className="text-sm font-medium text-[#6B7280] transition hover:text-[#111827]"
            >
              Solutions
            </Link>

            <Link
              href="#pricing"
              className="text-sm font-medium text-[#6B7280] transition hover:text-[#111827]"
            >
              Pricing
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden px-4 py-2 text-sm font-semibold text-[#374151] transition hover:text-[#1E84E7] sm:block"
            >
              Log in
            </Link>

            <Link
              href="/signup"
              className="rounded-lg bg-[#1E84E7] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1E66AA]"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(30,132,231,0.12),transparent_35%)]" />

        <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 py-20 lg:grid-cols-2 lg:px-8 lg:py-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3.5 py-1.5 text-sm font-medium text-[#1E84E7]">
              <span className="h-2 w-2 rounded-full bg-[#1E84E7]" />
              Simple business management
            </div>

            <h1 className="max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight text-[#111827] sm:text-6xl lg:text-7xl">
              Your business,
              <span className="block text-[#1E84E7]">
                all in one place.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-[#6B7280]">
              Track sales. Manage expenses. Monitor inventory. Understand
              your profit. NousBiz gives you the tools to run your business
              with clarity and confidence.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E84E7] px-6 py-3.5 font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-[#1E66AA]"
              >
                Get started free
                <ArrowRight
                  size={18}
                  className="transition-transform group-hover:translate-x-1"
                />
              </Link>

              <Link
                href="#features"
                className="inline-flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-6 py-3.5 font-semibold text-[#374151] transition hover:border-[#D1D5DB] hover:bg-[#F8FAFC]"
              >
                See how it works
              </Link>
            </div>

            <p className="mt-4 text-sm text-[#9CA3AF]">
              Start free. No credit card required.
            </p>
          </div>

          {/* Dashboard Preview */}
          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-indigo-500/10 blur-3xl" />

            <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl shadow-slate-900/10">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
                <div>
                  <p className="text-xs font-medium text-[#9CA3AF]">
                    Overview
                  </p>
                  <p className="mt-1 font-semibold">Good morning 👋</p>
                </div>

                <div className="rounded-lg bg-[#F8FAFC] px-3 py-2 text-xs font-medium text-[#6B7280]">
                  This month
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
                {[
                  ["Revenue", "₦850,000"],
                  ["Expenses", "₦230,000"],
                  ["Profit", "₦620,000"],
                  ["Sales", "128"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-[#E5E7EB] p-4"
                  >
                    <p className="text-xs text-[#6B7280]">{label}</p>
                    <p className="mt-2 text-lg font-bold">{value}</p>
                  </div>
                ))}
              </div>

              <div className="px-5 pb-5">
                <div className="rounded-xl border border-[#E5E7EB] p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Sales overview</p>
                      <p className="mt-1 text-xs text-[#9CA3AF]">
                        Revenue performance
                      </p>
                    </div>

                    <span className="text-sm font-semibold text-[#16A34A]">
                      +12.5%
                    </span>
                  </div>

                  <div className="mt-6 flex h-32 items-end gap-2">
                    {[35, 48, 42, 62, 55, 78, 68, 90, 74, 96, 82, 100].map(
                      (height, index) => (
                        <div
                          key={index}
                          className="flex-1 rounded-t-md bg-[#1E84E7]/15"
                          style={{ height: `${height}%` }}
                        >
                          <div
                            className="h-full rounded-t-md bg-[#1E84E7]"
                            style={{
                              height: index === 11 ? "100%" : `${height * 0.7}%`,
                            }}
                          />
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-y border-[#E5E7EB] bg-[#F8FAFC]">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-[#1E84E7]">
              Everything in one place
            </p>

            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need to run your business.
            </h2>

            <p className="mt-4 text-lg leading-8 text-[#6B7280]">
              From your first sale to your next big decision, NousBiz keeps
              your business organized and gives you a clearer picture of what
              is happening.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-[#E5E7EB] bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-900/5"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-[#1E84E7]">
                    <Icon size={21} />
                  </div>

                  <h3 className="mt-5 text-lg font-semibold">
                    {feature.title}
                  </h3>

                  <p className="mt-2 leading-7 text-[#6B7280]">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Business Types */}
      <section id="businesses" className="bg-white">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-24">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-[#1E84E7]">
                Built for your business
              </p>

              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                One platform. Different businesses.
              </h2>

              <p className="mt-5 max-w-xl text-lg leading-8 text-[#6B7280]">
                Whether you sell products, provide services, run a restaurant,
                or manage a growing team, NousBiz adapts to the way your
                business works.
              </p>

              <Link
                href="/signup"
                className="mt-8 inline-flex items-center gap-2 font-semibold text-[#1E84E7] hover:text-[#1E66AA]"
              >
                Create your workspace
                <ArrowRight size={17} />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {businessTypes.map((type) => (
                <div
                  key={type}
                  className="flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-4 text-sm font-medium text-[#374151]"
                >
                  <Check size={16} className="shrink-0 text-[#1E84E7]" />
                  {type}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section id="pricing" className="bg-[#F8FAFC]">
        <div className="mx-auto max-w-7xl px-6 py-20 text-center lg:px-8 lg:py-24">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#1E84E7]">
            Simple pricing
          </p>

          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Start free. Grow when you&apos;re ready.
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-lg text-[#6B7280]">
            Begin with the essentials and upgrade when your business needs
            more.
          </p>

          <div className="mx-auto mt-10 grid max-w-6xl gap-5 text-left md:grid-cols-3">
            {Object.entries(PLAN_CATALOG).map(([plan, details]) => {
              const features =
                plan === "free"
                  ? [
                      "All current modules",
                      "50 sales per calendar month",
                      "50 expenses per calendar month",
                      "50 invoices per calendar month",
                      "50 products and 50 customers per month",
                      "1 business member",
                    ]
                  : plan === "premium"
                    ? [
                        "All current modules",
                        "Unlimited monthly records",
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
                  key={plan}
                  className="flex flex-col rounded-2xl border border-[#E5E7EB] bg-white p-7 shadow-sm"
                >
                  <p className="text-lg font-semibold">{details.name}</p>

                  <div className="mt-3 flex items-end gap-1">
                    <span className="text-4xl font-bold">
                      ₦{details.amount.toLocaleString("en-NG")}
                    </span>
                    <span className="mb-1 text-[#6B7280]">
                      {details.amount ? "/ month" : "forever"}
                    </span>
                  </div>

                  <p className="mt-3 min-h-10 text-sm text-[#6B7280]">
                    {details.description}
                  </p>

                  <ul className="mt-6 flex-1 space-y-3">
                    {features.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-3 text-sm text-[#374151]"
                      >
                        <Check
                          size={16}
                          className="mt-0.5 shrink-0 text-[#16A34A]"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/signup"
                    className="mt-7 flex w-full items-center justify-center rounded-xl bg-[#1E84E7] px-5 py-3 font-semibold text-white transition hover:bg-[#1E66AA]"
                  >
                    {plan === "free" ? "Get started free" : "Get started"}
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0C1936]">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center lg:py-24">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to run your business smarter?
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-indigo-200">
            Bring your sales, expenses, inventory, customers, and business
            insights together with NousBiz.
          </p>

          <Link
            href="/signup"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 font-semibold text-[#0C1936] transition hover:bg-indigo-50"
          >
            Start using NousBiz
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E5E7EB] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div>
            <div className="flex items-center gap-2">
              <BrandLogo className="h-8 w-auto" />
              <span className="font-bold">NousBiz</span>
            </div>

            <p className="mt-2 text-sm text-[#9CA3AF]">
              © {new Date().getFullYear()} Nous Technologies Limited.
            </p>
          </div>

          <div className="flex flex-wrap gap-5 text-sm text-[#6B7280]">
            <Link href="#" className="hover:text-[#111827]">
              Privacy
            </Link>

            <Link href="#" className="hover:text-[#111827]">
              Terms
            </Link>

            <Link href="#" className="hover:text-[#111827]">
              Contact
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}