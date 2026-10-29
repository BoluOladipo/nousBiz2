"use client";

import Link from "next/link";
import { MailCheck } from "lucide-react";
import BrandLogo from "../brand-logo";

export default function VerifyEmailPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
          <BrandLogo className="mx-auto mb-6 h-10 w-auto" />
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50">
            <MailCheck className="h-7 w-7 text-indigo-600" />
          </div>

          <h1 className="text-2xl font-semibold text-slate-900">
            Check your email
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            We&apos;ve sent you a verification link. Please check your inbox
            and click the link to verify your NousBiz account.
          </p>

          <p className="mt-4 text-xs text-slate-400">
            Don&apos;t see the email? Check your spam or junk folder.
          </p>

          <Link
            href="/login"
            className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            Go to login
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Nous Technologies Limited
        </p>
      </div>
    </main>
  );
}