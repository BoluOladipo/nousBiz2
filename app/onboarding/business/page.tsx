"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BrandLogo from "../../brand-logo";

const businessTypes = [
  "Retail / Wholesale",
  "Restaurant / Food",
  "Fashion",
  "Beauty / Barber",
  "Freelancer",
  "Professional Services",
  "Digital Business",
  "Logistics",
  "Technology",
  "Manufacturing",
  "Other",
];

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error) {
    return error;
  }

  if (typeof error === "object" && error !== null) {
    const details = error as Record<string, unknown>;
    const messages = [details.message, details.details, details.hint].filter(
      (value): value is string => typeof value === "string" && value.length > 0
    );

    if (messages.length > 0) {
      const code =
        typeof details.code === "string" ? ` (code: ${details.code})` : "";
      return `${messages.join(" ")}${code}`;
    }

    if (typeof details.code === "string") {
      return `Request failed (code: ${details.code}).`;
    }
  }

  return fallback;
}

export default function CreateBusinessPage() {
  const supabase = createClient();
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [checkingBusiness, setCheckingBusiness] = useState(true);
  const [businessCheckFailed, setBusinessCheckFailed] = useState(false);
  const [checkAttempt, setCheckAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function checkExistingBusiness() {
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
          .select("business_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (membershipError) throw membershipError;

        if (membership) {
          router.replace("/dashboard");
          return;
        }
      } catch (error) {
        console.error("Failed to check existing business:", error);
        if (!cancelled) {
          setBusinessCheckFailed(true);
          setErrorMessage(
            `Could not check your existing business: ${getErrorMessage(
              error,
              "Please try again."
            )}`
          );
        }
      } finally {
        if (!cancelled) setCheckingBusiness(false);
      }
    }

    void checkExistingBusiness();

    return () => {
      cancelled = true;
    };
  }, [checkAttempt, router, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading || checkingBusiness || businessCheckFailed) return;

    setErrorMessage("");

    if (!name.trim()) {
      setErrorMessage("Please enter your business name.");
      return;
    }

    if (!businessType) {
      setErrorMessage("Please select your business type.");
      return;
    }

    setLoading(true);

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

      const { data: existingMembership, error: membershipError } =
        await supabase
          .from("business_members")
          .select("business_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

      if (membershipError) throw membershipError;

      if (existingMembership) {
        router.replace("/dashboard");
        return;
      }

      const { error } = await supabase.rpc("create_business", {
        p_name: name.trim(),
        p_description: description.trim(),
        p_business_type: businessType,
        p_country: "Nigeria",
        p_currency: "NGN",
        p_timezone: "Africa/Lagos",
      });

      if (error) throw error;

      const { data: createdMembership, error: createdMembershipError } =
        await supabase
          .from("business_members")
          .select("business_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

      if (createdMembershipError) throw createdMembershipError;

      if (!createdMembership) {
        throw new Error(
          "The request completed, but no business was linked to your account. Please try again or contact support."
        );
      }

      router.replace("/dashboard");
    } catch (error) {
      console.error("Failed to create business:", error);
      setErrorMessage(
        `Business creation failed: ${getErrorMessage(
          error,
          "Please try again."
        )}`
      );
    } finally {
      setLoading(false);
    }
  }

  if (checkingBusiness) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking your business...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-xl items-center justify-center">
        <div className="w-full">
          <div className="mb-8 text-center">
            <BrandLogo className="mx-auto mb-5 h-12 w-auto" />

            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Create your business
            </h1>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Tell us a little about your business so we can set up your
              NousBiz workspace.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="business-name"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Business name
                </label>

                <input
                  id="business-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Bolu Fashion Store"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>

              <div>
                <label
                  htmlFor="business-description"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Description{" "}
                  <span className="font-normal text-slate-400">
                    (optional)
                  </span>
                </label>

                <textarea
                  id="business-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Tell us briefly about your business"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>

              <div>
                <label className="mb-3 block text-sm font-medium text-slate-700">
                  What type of business do you run?
                </label>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {businessTypes.map((type) => {
                    const selected = businessType === type;

                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setBusinessType(type)}
                        className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                          selected
                            ? "border-indigo-500 bg-indigo-50 font-medium text-indigo-700 ring-2 ring-indigo-500/10"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>

              {errorMessage && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {errorMessage}
                </div>
              )}

              {businessCheckFailed && (
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage("");
                    setBusinessCheckFailed(false);
                    setCheckingBusiness(true);
                    setCheckAttempt((attempt) => attempt + 1);
                  }}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Retry business check
                </button>
              )}

              <button
                type="submit"
                disabled={loading || checkingBusiness || businessCheckFailed}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating workspace...
                  </>
                ) : (
                  "Create business"
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            Your business data is private to your workspace.
          </p>
        </div>
      </div>
    </main>
  );
}