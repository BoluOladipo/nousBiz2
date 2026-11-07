"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import BrandLogo from "../brand-logo";

const PASSWORD_REQUIREMENTS =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    let active = true;

    async function prepareRecovery() {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const tokenHash = params.get("token_hash");
        const authError = params.get("error_description");
        if (authError) throw new Error(authError);

        const { data: existingSession, error: sessionError } =
          await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (existingSession.session) {
          if (active) setReady(true);
          return;
        }

        if (code) {
          const { data, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          if (!data.session) {
            throw new Error("This password reset link is invalid or expired.");
          }
        } else if (tokenHash) {
          const { data, error: verifyError } = await supabase.auth.verifyOtp({
            type: "recovery",
            token_hash: tokenHash,
          });
          if (verifyError) throw verifyError;
          if (!data.session) {
            throw new Error("This password reset link is invalid or expired.");
          }
        } else {
          throw new Error("This password reset link is invalid or expired.");
        }

        if (active) setReady(true);
      } catch (recoveryError) {
        console.error("Could not verify password reset link:", recoveryError);
        if (active) {
          setError(
            recoveryError instanceof Error
              ? recoveryError.message
              : "This password reset link is invalid or expired."
          );
        }
      }
    }

    void prepareRecovery();
    return () => {
      active = false;
    };
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

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
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;
      setUpdated(true);
    } catch (passwordError) {
      console.error("Could not update password:", passwordError);
      setError(
        passwordError instanceof Error
          ? passwordError.message
          : "Could not update your password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center justify-center">
        <div className="w-full">
          <div className="mb-8 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900"
            >
              <BrandLogo className="h-9 w-auto" />
              NousBiz
            </Link>
            <h1 className="mt-8 text-2xl font-semibold tracking-tight text-slate-900">
              Choose a new password
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Use at least 8 characters with uppercase, lowercase, a number,
              and a symbol.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            {updated ? (
              <div role="status" className="space-y-4 text-center">
                <p className="text-sm text-slate-600">
                  Your password has been updated.
                </p>
                <Link
                  href="/login"
                  className="inline-flex text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Go to sign in
                </Link>
              </div>
            ) : !ready ? (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-500">
                {!error && <Loader2 className="h-4 w-4 animate-spin" />}
                {error || "Verifying your reset link..."}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    New password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirm-password"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Confirm new password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                  />
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? "Updating password..." : "Update password"}
                </button>
              </form>
            )}

            {error && !ready && (
              <div className="mt-5 text-center">
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Request a new reset link
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
