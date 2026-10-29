"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/error-message";
import { getPlanLimitMessage } from "@/lib/billing/errors";
import {
  CalendarDays,
  CircleDollarSign,
  FileText,
  Plus,
  Search,
  Wallet,
  X,
} from "lucide-react";

type Category = {
  id: string;
  name: string;
};

type Expense = {
  id: string;
  category_id: string | null;
  description: string;
  amount: number;
  payment_method: string;
  expense_date: string;
  notes: string | null;
};

const paymentMethods = [
  { value: "cash", label: "Cash" },
  { value: "transfer", label: "Transfer" },
  { value: "pos", label: "POS" },
  { value: "other", label: "Other" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
  }).format(new Date(`${value}T00:00:00`));
}

function getToday() {
  return new Date().toISOString().split("T")[0];
}

export default function ExpensesPage() {
  const supabase = createClient();

  const [businessId, setBusinessId] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [showDrawer, setShowDrawer] = useState(false);

  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(getToday());
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadExpenses();
  }, []);

  async function loadExpenses() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: membership, error: membershipError } =
        await supabase
          .from("business_members")
          .select("business_id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

      if (membershipError) {
        throw membershipError;
      }

      if (!membership) {
        window.location.href = "/onboarding/business";
        return;
      }

      const currentBusinessId = membership.business_id;

      setBusinessId(currentBusinessId);

      // Make sure the default expense categories exist.
      const { error: categorySetupError } =
        await supabase.rpc(
          "create_default_expense_categories",
          {
            p_business_id: currentBusinessId,
          }
        );

      if (categorySetupError) {
        throw categorySetupError;
      }

      const [
        { data: categoryData, error: categoryError },
        { data: expenseData, error: expenseError },
      ] = await Promise.all([
        supabase
          .from("expense_categories")
          .select("id, name")
          .eq("business_id", currentBusinessId)
          .order("name", { ascending: true }),

        supabase
          .from("expenses")
          .select(
            "id, category_id, description, amount, payment_method, expense_date, notes"
          )
          .eq("business_id", currentBusinessId)
          .order("expense_date", {
            ascending: false,
          })
          .order("created_at", {
            ascending: false,
          }),
      ]);

      if (categoryError) {
        throw categoryError;
      }

      if (expenseError) {
        throw expenseError;
      }

      setCategories(categoryData ?? []);
      setExpenses(expenseData ?? []);
    } catch (err) {
      console.error(err);
      setError("We couldn't load your expenses.");
    } finally {
      setLoading(false);
    }
  }

  const categoryMap = useMemo(() => {
    return new Map(
      categories.map((category) => [
        category.id,
        category.name,
      ])
    );
  }, [categories]);

  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return expenses.filter((expense) => {
      const categoryName = expense.category_id
        ? categoryMap.get(expense.category_id)
        : "";

      const matchesSearch =
        !query ||
        expense.description.toLowerCase().includes(query) ||
        categoryName?.toLowerCase().includes(query);

      const matchesCategory =
        categoryFilter === "all" ||
        expense.category_id === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [
    expenses,
    search,
    categoryFilter,
    categoryMap,
  ]);

  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0
  );

  const filteredTotal = filteredExpenses.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0
  );

  function resetForm() {
    setDescription("");
    setCategoryId("");
    setAmount("");
    setExpenseDate(getToday());
    setPaymentMethod("cash");
    setNotes("");
    setError("");
  }

  async function createExpense() {
    if (!businessId) {
      setError("Business information is missing.");
      return;
    }

    if (!description.trim()) {
      setError("Please enter an expense description.");
      return;
    }

    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount <= 0) {
      setError("Enter an expense amount greater than zero.");
      return;
    }

    if (!expenseDate) {
      setError("Please select an expense date.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { error: insertError } = await supabase
        .from("expenses")
        .insert({
          business_id: businessId,
          category_id: categoryId || null,
          description: description.trim(),
          amount: numericAmount,
          expense_date: expenseDate,
          payment_method: paymentMethod,
          notes: notes.trim() || null,
          created_by: user.id,
        });

      if (insertError) {
        throw insertError;
      }

      setSuccess("Expense recorded successfully.");

      resetForm();
      setShowDrawer(false);

      await loadExpenses();

      setTimeout(() => {
        setSuccess("");
      }, 4000);
    } catch (err: unknown) {
      console.error(err);
      setError(
        getPlanLimitMessage(err) ??
          getErrorMessage(err, "We couldn't record this expense.")
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#111827]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm text-[#6B7280]">
              <Wallet className="h-4 w-4" />
              Expenses
            </div>

            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Expenses
            </h1>

            <p className="mt-1 text-sm text-[#6B7280]">
              Track where your business money goes.
            </p>
          </div>

          <button
            onClick={() => {
              resetForm();
              setShowDrawer(true);
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1E84E7] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1E66AA] focus:outline-none focus:ring-4 focus:ring-indigo-100"
          >
            <Plus className="h-4 w-4" />
            Add expense
          </button>
        </div>

        {/* Success */}
        {success && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            {success}
          </div>
        )}

        {/* Error */}
        {error && !showDrawer && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Summary cards */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <CircleDollarSign className="h-5 w-5" />
            </div>

            <p className="text-sm text-[#6B7280]">
              Total expenses
            </p>

            <p className="mt-1 text-2xl font-semibold">
              {formatCurrency(totalExpenses)}
            </p>
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-[#1E84E7]">
              <FileText className="h-5 w-5" />
            </div>

            <p className="text-sm text-[#6B7280]">
              Expense records
            </p>

            <p className="mt-1 text-2xl font-semibold">
              {expenses.length}
            </p>
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <CalendarDays className="h-5 w-5" />
            </div>

            <p className="text-sm text-[#6B7280]">
              Filtered total
            </p>

            <p className="mt-1 text-2xl font-semibold">
              {formatCurrency(filteredTotal)}
            </p>
          </div>

        </div>

        {/* Expense table */}
        <section className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">

          <div className="border-b border-[#E5E7EB] p-4 sm:p-5">

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

              <div className="relative w-full lg:max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="Search expenses..."
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] pl-10 pr-4 text-sm outline-none transition focus:border-[#1E84E7] focus:ring-4 focus:ring-indigo-50"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) =>
                  setCategoryFilter(e.target.value)
                }
                className="h-11 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm outline-none focus:border-[#1E84E7] focus:ring-4 focus:ring-indigo-50"
              >
                <option value="all">
                  All categories
                </option>

                {categories.map((category) => (
                  <option
                    key={category.id}
                    value={category.id}
                  >
                    {category.name}
                  </option>
                ))}
              </select>

            </div>

          </div>

          {loading ? (
            <div className="space-y-4 p-6">
              {[1, 2, 3, 4].map((item) => (
                <div
                  key={item}
                  className="h-14 animate-pulse rounded-xl bg-[#F3F4F6]"
                />
              ))}
            </div>
          ) : filteredExpenses.length === 0 ? (

            <div className="px-6 py-16 text-center">

              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-[#1E84E7]">
                <Wallet className="h-6 w-6" />
              </div>

              <h3 className="text-base font-semibold">
                No expenses yet
              </h3>

              <p className="mx-auto mt-1 max-w-sm text-sm text-[#6B7280]">
                Record your first business expense to start
                tracking your costs.
              </p>

              <button
                onClick={() => {
                  resetForm();
                  setShowDrawer(true);
                }}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#1E84E7] px-4 text-sm font-semibold text-white hover:bg-[#1E66AA]"
              >
                <Plus className="h-4 w-4" />
                Add expense
              </button>

            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full min-w-[800px] text-left">

                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#6B7280]">

                    <th className="px-5 py-4">
                      Description
                    </th>

                    <th className="px-5 py-4">
                      Category
                    </th>

                    <th className="px-5 py-4">
                      Date
                    </th>

                    <th className="px-5 py-4">
                      Payment
                    </th>

                    <th className="px-5 py-4 text-right">
                      Amount
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {filteredExpenses.map((expense) => (

                    <tr
                      key={expense.id}
                      className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#FAFAFA]"
                    >

                      <td className="px-5 py-4">

                        <div>
                          <p className="text-sm font-semibold">
                            {expense.description}
                          </p>

                          {expense.notes && (
                            <p className="mt-1 max-w-xs truncate text-xs text-[#9CA3AF]">
                              {expense.notes}
                            </p>
                          )}
                        </div>

                      </td>

                      <td className="px-5 py-4">

                        <span className="inline-flex rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-[#1E84E7]">
                          {expense.category_id
                            ? categoryMap.get(
                                expense.category_id
                              ) ?? "Uncategorized"
                            : "Uncategorized"}
                        </span>

                      </td>

                      <td className="px-5 py-4 text-sm text-[#6B7280]">
                        {formatDate(
                          expense.expense_date
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm">
                        {
                          paymentMethods.find(
                            (method) =>
                              method.value ===
                              expense.payment_method
                          )?.label
                        }
                      </td>

                      <td className="px-5 py-4 text-right text-sm font-semibold text-red-600">
                        − {formatCurrency(
                          Number(expense.amount)
                        )}
                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </section>

      </div>

      {/* Add Expense Drawer */}
      {showDrawer && (

        <div className="fixed inset-0 z-50">

          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            onClick={() =>
              !saving && setShowDrawer(false)
            }
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">

              <div>
                <h2 className="text-lg font-semibold">
                  Add expense
                </h2>

                <p className="text-sm text-[#6B7280]">
                  Record a business expense.
                </p>
              </div>

              <button
                onClick={() =>
                  setShowDrawer(false)
                }
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]"
              >
                <X className="h-5 w-5" />
              </button>

            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5">

              {error && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              {/* Description */}
              <div className="mb-5">

                <label className="mb-2 block text-sm font-medium">
                  Description
                </label>

                <input
                  value={description}
                  onChange={(e) =>
                    setDescription(e.target.value)
                  }
                  placeholder="e.g. Shop electricity bill"
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] px-3 text-sm outline-none focus:border-[#1E84E7] focus:ring-4 focus:ring-indigo-50"
                />

              </div>

              {/* Category */}
              <div className="mb-5">

                <label className="mb-2 block text-sm font-medium">
                  Category
                </label>

                <select
                  value={categoryId}
                  onChange={(e) =>
                    setCategoryId(e.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#1E84E7] focus:ring-4 focus:ring-indigo-50"
                >
                  <option value="">
                    Select a category
                  </option>

                  {categories.map((category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </option>
                  ))}

                </select>

              </div>

              {/* Amount */}
              <div className="mb-5">

                <label className="mb-2 block text-sm font-medium">
                  Amount
                </label>

                <div className="relative">

                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B7280]">
                    ₦
                  </span>

                  <input
                    type="number"
                    min="0"
                    value={amount}
                    onChange={(e) =>
                      setAmount(e.target.value)
                    }
                    placeholder="0"
                    className="h-11 w-full rounded-xl border border-[#E5E7EB] pl-8 pr-4 text-sm outline-none focus:border-[#1E84E7] focus:ring-4 focus:ring-indigo-50"
                  />

                </div>

              </div>

              {/* Date */}
              <div className="mb-5">

                <label className="mb-2 block text-sm font-medium">
                  Expense date
                </label>

                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) =>
                    setExpenseDate(e.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] px-3 text-sm outline-none focus:border-[#1E84E7] focus:ring-4 focus:ring-indigo-50"
                />

              </div>

              {/* Payment method */}
              <div className="mb-5">

                <label className="mb-2 block text-sm font-medium">
                  Payment method
                </label>

                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#1E84E7] focus:ring-4 focus:ring-indigo-50"
                >

                  {paymentMethods.map((method) => (
                    <option
                      key={method.value}
                      value={method.value}
                    >
                      {method.label}
                    </option>
                  ))}

                </select>

              </div>

              {/* Notes */}
              <div className="mb-6">

                <label className="mb-2 block text-sm font-medium">
                  Notes
                  <span className="ml-1 font-normal text-[#9CA3AF]">
                    (optional)
                  </span>
                </label>

                <textarea
                  value={notes}
                  onChange={(e) =>
                    setNotes(e.target.value)
                  }
                  rows={4}
                  placeholder="Add additional details..."
                  className="w-full resize-none rounded-xl border border-[#E5E7EB] px-3 py-3 text-sm outline-none focus:border-[#1E84E7] focus:ring-4 focus:ring-indigo-50"
                />

              </div>

              {/* Preview */}
              {Number(amount) > 0 && (
                <div className="rounded-2xl bg-[#F8FAFC] p-4">

                  <div className="flex items-center justify-between">

                    <span className="text-sm text-[#6B7280]">
                      Expense amount
                    </span>

                    <span className="text-xl font-bold text-red-600">
                      − {formatCurrency(
                        Number(amount)
                      )}
                    </span>

                  </div>

                </div>
              )}

            </div>

            {/* Footer */}
            <div className="border-t border-[#E5E7EB] bg-white px-5 py-4">

              <div className="flex gap-3">

                <button
                  type="button"
                  onClick={() =>
                    setShowDrawer(false)
                  }
                  disabled={saving}
                  className="h-11 flex-1 rounded-xl border border-[#E5E7EB] px-4 text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB]"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={createExpense}
                  disabled={saving}
                  className="h-11 flex-1 rounded-xl bg-[#1E84E7] px-4 text-sm font-semibold text-white transition hover:bg-[#1E66AA] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : "Record expense"}
                </button>

              </div>

            </div>

          </aside>

        </div>

      )}

    </main>
  );
}