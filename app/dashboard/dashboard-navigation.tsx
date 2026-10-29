"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut, Menu, Settings, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import BrandLogo from "../brand-logo";

const navigationItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Sales", href: "/sales" },
  { label: "Expenses", href: "/expenses" },
  { label: "Products / Services", href: "/products" },
  { label: "Inventory", href: "/inventory" },
  { label: "Customers", href: "/customers" },
  { label: "Invoices", href: "/invoices" },
  { label: "Notifications", href: "/notifications" },
  { label: "Plans & billing", href: "/billing" },
  { label: "Settings", href: "/settings" },
];

const appRoutes = new Set(navigationItems.map((item) => item.href));

export default function DashboardNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [userName, setUserName] = useState("Account");
  const [userEmail, setUserEmail] = useState("");
  const [accountError, setAccountError] = useState("");
  const isAppRoute = pathname ? appRoutes.has(pathname) : false;

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.error("Could not load account information:", error);
        return;
      }

      const email = data.user?.email ?? "";
      setUserEmail(email);
      setUserName(
        data.user?.user_metadata?.full_name ||
          email.split("@")[0] ||
          "Account"
      );
    });

    return () => {
      active = false;
    };
  }, [supabase]);

  if (!isAppRoute) return null;

  async function signOut() {
    setAccountError("");
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Could not sign out:", error);
      setAccountError(error.message);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  function renderNavigationItems() {
    return navigationItems.map((item) => {
      const active = pathname === item.href;

      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setMobileMenuOpen(false)}
          aria-current={active ? "page" : undefined}
          className={`block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
            active
              ? "bg-indigo-50 text-indigo-700"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          }`}
        >
          {item.label}
        </Link>
      );
    });
  }

  return (
    <>
      <header className="relative z-30 border-b border-slate-200 bg-white">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Open navigation"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-dashboard-navigation"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Link href="/dashboard" className="flex items-center gap-3">
              <BrandLogo className="h-9 w-auto" />
              <span className="text-lg font-bold tracking-tight text-slate-900">
                NousBiz
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/notifications"
              className="rounded-xl p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </Link>

            <div className="hidden h-8 w-px bg-slate-200 sm:block" />

            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountMenuOpen((open) => !open)}
                className="flex items-center gap-1 rounded-full p-1 text-slate-600 transition hover:bg-slate-100"
                aria-label="Open account menu"
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-600">
                  {userName.charAt(0).toUpperCase()}
                </span>
                <ChevronDown className="hidden h-4 w-4 sm:block" />
              </button>

              {accountMenuOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-30 cursor-default"
                    aria-label="Close account menu"
                    onClick={() => setAccountMenuOpen(false)}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
                  >
                    <div className="border-b border-slate-100 px-3 py-2">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {userName}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {userEmail}
                      </p>
                    </div>
                    <Link
                      href="/settings"
                      role="menuitem"
                      onClick={() => setAccountMenuOpen(false)}
                      className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <Settings className="h-4 w-4" />
                      Account settings
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void signOut()}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                    {accountError && (
                      <p role="alert" className="px-3 py-2 text-xs text-red-600">
                        {accountError}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 h-full w-full bg-slate-950/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close navigation"
          />

          <aside
            id="mobile-dashboard-navigation"
            aria-label="Mobile navigation"
            className="relative flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <span className="text-lg font-bold tracking-tight text-slate-900">
                NousBiz
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav
              aria-label="Main navigation"
              className="space-y-1 overflow-y-auto px-3 pb-4"
            >
              {renderNavigationItems()}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
