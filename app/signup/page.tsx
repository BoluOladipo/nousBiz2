"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import BrandLogo from "../brand-logo";

const PASSWORD_REQUIREMENTS =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export default function SignupPage() {
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (!PASSWORD_REQUIREMENTS.test(password)) {
      setError(
        "Your password must be at least 8 characters and include a lowercase letter, an uppercase letter, a number, and a symbol."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error: signupError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo: `${window.location.origin}/verify-email`,
        },
      });

      if (signupError) {
        setError(signupError.message);
        return;
      }

      setSuccess(true);
    } catch (signupError) {
      console.error("Signup request failed:", signupError);
      setError(
        signupError instanceof TypeError
          ? "Unable to connect to the signup service. Check your internet connection and Supabase project configuration, then try again."
          : "An unexpected error occurred while creating your account. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <main className="min-h-screen bg-[#F8FAFC] px-6 py-12">
        <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
          <div className="w-full rounded-2xl border border-[#E5E7EB] bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
              <Check className="text-[#16A34A]" size={26} />
            </div>

            <h1 className="mt-6 text-2xl font-bold text-[#111827]">
              Check your email
            </h1>

            <p className="mt-3 leading-7 text-[#6B7280]">
              We&apos;ve sent a verification link to{" "}
              <strong className="font-semibold text-[#374151]">
                {email}
              </strong>
              .
            </p>

            <p className="mt-3 text-sm leading-6 text-[#9CA3AF]">
              Click the link in the email to verify your account and continue
              setting up your NousBiz workspace.
            </p>

            <Link
              href="/login"
              className="mt-7 inline-flex items-center gap-2 font-semibold text-[#1E84E7] hover:text-[#1E66AA]"
            >
              Go to login
              <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC]">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-12 lg:px-8">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-[#E5E7EB] bg-white shadow-xl shadow-slate-900/5 lg:grid-cols-2">
          {/* Left side */}
          <div className="hidden bg-[#0C1936] p-10 text-white lg:block">
            <Link href="/" className="flex items-center gap-2">
              <BrandLogo className="h-10 w-auto" />
              <span className="text-xl font-bold">NousBiz</span>
            </Link>

            <div className="mt-24">
              <h2 className="text-4xl font-bold leading-tight">
                Run your business with clarity.
              </h2>

              <p className="mt-5 max-w-md leading-7 text-indigo-200">
                Bring your sales, expenses, inventory, customers and business
                insights together in one simple workspace.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  "Track sales and revenue",
                  "Manage expenses",
                  "Monitor inventory",
                  "Understand your business performance",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-400/20">
                      <Check size={14} />
                    </div>

                    <span className="text-sm text-indigo-100">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="p-6 sm:p-10">
            <div className="mb-8 lg:hidden">
              <Link href="/" className="flex items-center gap-2">
                <BrandLogo className="h-9 w-auto" />
                <span className="text-xl font-bold text-[#111827]">
                  NousBiz
                </span>
              </Link>
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl">
                Create your account
              </h1>

              <p className="mt-2 text-[#6B7280]">
                Start managing your business with NousBiz.
              </p>
            </div>

            <form onSubmit={handleSignup} className="mt-8 space-y-5">
              <div>
                <label
                  htmlFor="fullName"
                  className="mb-2 block text-sm font-medium text-[#374151]"
                >
                  Full name
                </label>

                <input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Enter your full name"
                  className="h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm outline-none transition placeholder:text-[#9CA3AF] focus:border-[#1E84E7] focus:ring-4 focus:ring-indigo-500/10"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-[#374151]"
                >
                  Email address
                </label>

                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm outline-none transition placeholder:text-[#9CA3AF] focus:border-[#1E84E7] focus:ring-4 focus:ring-indigo-500/10"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-[#374151]"
                >
                  Password
                </label>

                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Create a strong password"
                  className="h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm outline-none transition placeholder:text-[#9CA3AF] focus:border-[#1E84E7] focus:ring-4 focus:ring-indigo-500/10"
                  minLength={8}
                  pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}"
                  title="Use at least 8 characters, including a lowercase letter, an uppercase letter, a number, and a symbol."
                  required
                />
                <p className="mt-2 text-xs leading-5 text-[#6B7280]">
                  Use at least 8 characters, with a lowercase letter, an
                  uppercase letter, a number, and a symbol.
                </p>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-sm font-medium text-[#374151]"
                >
                  Confirm password
                </label>

                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  placeholder="Enter your password again"
                  className="h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm outline-none transition placeholder:text-[#9CA3AF] focus:border-[#1E84E7] focus:ring-4 focus:ring-indigo-500/10"
                  required
                />
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-[#DC2626]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1E84E7] px-5 font-semibold text-white transition hover:bg-[#1E66AA] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Creating account...
                  </>
                ) : (
                  <>
                    Create account
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-[#6B7280]">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-[#1E84E7] hover:text-[#1E66AA]"
              >
                Log in
              </Link>
            </p>

            <p className="mt-6 text-center text-xs leading-5 text-[#9CA3AF]">
              By creating an account, you agree to our Terms of Service and
              Privacy Policy.
            </p>
            <p className="mt-6 text-center text-xs leading-5 text-[#9CA3AF]">
             Powered by Nous Technology Limited.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}