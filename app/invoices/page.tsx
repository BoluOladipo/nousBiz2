"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  FileText,
  Plus,
  Search,
  User,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPlanLimitMessage } from "@/lib/billing/errors";

type Product = {
  id: string;
  name: string;
  item_type: "product" | "service";
  selling_price: number;
  stock_quantity: number;
};

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

type InvoiceStatus =
  | "draft"
  | "sent"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled";

type Invoice = {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amount_paid: number;
  due_date: string | null;
  issued_at: string | null;
  created_at: string;
  customers: Customer | Customer[] | null;
};

type CartItem = {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
};

const supabase = createClient();

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatDate(date: string | null) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function statusLabel(status: InvoiceStatus) {
  switch (status) {
    case "draft":
      return "Draft";
    case "sent":
      return "Sent";
    case "partially_paid":
      return "Partially Paid";
    case "paid":
      return "Paid";
    case "overdue":
      return "Overdue";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

function statusClasses(status: InvoiceStatus) {
  switch (status) {
    case "paid":
      return "bg-green-50 text-green-700 ring-1 ring-green-200";
    case "partially_paid":
      return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
    case "sent":
      return "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200";
    case "overdue":
      return "bg-red-50 text-red-700 ring-1 ring-red-200";
    case "cancelled":
      return "bg-gray-100 text-gray-600 ring-1 ring-gray-200";
    case "draft":
    default:
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  }
}

function getCustomerName(
  customer: Customer | Customer[] | null | undefined
) {
  if (!customer) return "Walk-in customer";

  if (Array.isArray(customer)) {
    return customer[0]?.name || "Walk-in customer";
  }

  return customer.name || "Walk-in customer";
}

export default function InvoicesPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | InvoiceStatus
  >("all");

  const [showCreateDrawer, setShowCreateDrawer] = useState(false);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);

  const [selectedInvoice, setSelectedInvoice] =
    useState<Invoice | null>(null);

  const [showPaymentBox, setShowPaymentBox] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");

  const [customerId, setCustomerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [discount, setDiscount] = useState("");
  const [tax, setTax] = useState("");
  const [notes, setNotes] = useState("");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("1");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
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
          .limit(1)
          .maybeSingle();

      if (membershipError) {
        throw membershipError;
      }

      if (!membership) {
        window.location.href = "/onboarding/business";
        return;
      }

      setBusinessId(membership.business_id);

      const [
        invoicesResponse,
        productsResponse,
        customersResponse,
      ] = await Promise.all([
        supabase
          .from("invoices")
          .select(`
            id,
            invoice_number,
            status,
            subtotal,
            discount,
            tax,
            total,
            amount_paid,
            due_date,
            issued_at,
            created_at,
            customers (
              id,
              name,
              phone,
              email
            )
          `)
          .eq("business_id", membership.business_id)
          .order("created_at", { ascending: false }),

        supabase
          .from("products")
          .select(
            "id,name,item_type,selling_price,stock_quantity"
          )
          .eq("business_id", membership.business_id)
          .eq("is_active", true)
          .order("name"),

        supabase
          .from("customers")
          .select("id,name,phone,email")
          .eq("business_id", membership.business_id)
          .order("name"),
      ]);

      if (invoicesResponse.error) {
        throw invoicesResponse.error;
      }

      if (productsResponse.error) {
        throw productsResponse.error;
      }

      if (customersResponse.error) {
        throw customersResponse.error;
      }

      setInvoices((invoicesResponse.data || []) as Invoice[]);
      setProducts((productsResponse.data || []) as Product[]);
      setCustomers((customersResponse.data || []) as Customer[]);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load invoices."
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const customerName = getCustomerName(invoice.customers);

      const matchesSearch =
        !query ||
        invoice.invoice_number.toLowerCase().includes(query) ||
        customerName.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        invoice.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [invoices, search, statusFilter]);

  const summary = useMemo(() => {
    const total = invoices.reduce(
      (sum, invoice) => sum + Number(invoice.total || 0),
      0
    );

    const paid = invoices.reduce(
      (sum, invoice) => sum + Number(invoice.amount_paid || 0),
      0
    );

    const outstanding = invoices.reduce(
      (sum, invoice) =>
        sum +
        Math.max(
          Number(invoice.total || 0) -
            Number(invoice.amount_paid || 0),
          0
        ),
      0
    );

    return {
      total,
      paid,
      outstanding,
      count: invoices.length,
    };
  }, [invoices]);

  const subtotal = useMemo(() => {
    return cart.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );
  }, [cart]);

  const discountAmount = Math.max(
    Number(discount) || 0,
    0
  );

  const taxAmount = Math.max(Number(tax) || 0, 0);

  const invoiceTotal = Math.max(
    subtotal - discountAmount + taxAmount,
    0
  );

  function resetCreateForm() {
    setCustomerId("");
    setDueDate("");
    setDiscount("");
    setTax("");
    setNotes("");
    setCart([]);
    setSelectedProduct("");
    setQuantity("1");
    setError("");
  }

  function closeCreateDrawer() {
    setShowCreateDrawer(false);
    resetCreateForm();
  }

  function addItemToCart() {
    setError("");

    if (!selectedProduct) {
      setError("Select a product or service.");
      return;
    }

    const product = products.find(
      (item) => item.id === selectedProduct
    );

    if (!product) {
      setError("Selected product could not be found.");
      return;
    }

    const qty = Number(quantity);

    if (!qty || qty <= 0) {
      setError("Quantity must be greater than zero.");
      return;
    }

    if (
      product.item_type === "product" &&
      qty > product.stock_quantity
    ) {
      setError(
        "Only " +
          product.stock_quantity +
          " unit(s) of " +
          product.name +
          " are available."
      );
      return;
    }

    const existing = cart.find(
      (item) => item.product_id === product.id
    );

    if (existing) {
      const newQuantity = existing.quantity + qty;

      if (
        product.item_type === "product" &&
        newQuantity > product.stock_quantity
      ) {
        setError(
          "Only " +
            product.stock_quantity +
            " unit(s) of " +
            product.name +
            " are available."
        );
        return;
      }

      setCart((current) =>
        current.map((item) =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: newQuantity,
              }
            : item
        )
      );
    } else {
      setCart((current) => [
        ...current,
        {
          product_id: product.id,
          name: product.name,
          quantity: qty,
          unit_price: Number(product.selling_price || 0),
        },
      ]);
    }

    setSelectedProduct("");
    setQuantity("1");
  }

  function removeItem(productId: string) {
    setCart((current) =>
      current.filter((item) => item.product_id !== productId)
    );
  }

  function updateItemQuantity(
    productId: string,
    newQuantity: number
  ) {
    if (!newQuantity || newQuantity <= 0) {
      removeItem(productId);
      return;
    }

    const product = products.find(
      (item) => item.id === productId
    );

    if (
      product &&
      product.item_type === "product" &&
      newQuantity > product.stock_quantity
    ) {
      setError(
        "Only " +
          product.stock_quantity +
          " unit(s) of " +
          product.name +
          " are available."
      );
      return;
    }

    setCart((current) =>
      current.map((item) =>
        item.product_id === productId
          ? { ...item, quantity: newQuantity }
          : item
      )
    );
  }

  async function createInvoice() {
    setError("");
    setSuccess("");

    if (!businessId) {
      setError("Business could not be identified.");
      return;
    }

    if (cart.length === 0) {
      setError("Add at least one item to the invoice.");
      return;
    }

    if (discountAmount > subtotal) {
      setError("Discount cannot exceed the subtotal.");
      return;
    }

    setSaving(true);

    try {
      const items = cart.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      }));

      const { error: rpcError } = await supabase.rpc(
        "create_invoice",
        {
          p_business_id: businessId,
          p_customer_id: customerId || null,
          p_items: items,
          p_discount: discountAmount,
          p_tax: taxAmount,
          p_due_date: dueDate || null,
          p_notes: notes.trim() || null,
        }
      );

      if (rpcError) {
        throw rpcError;
      }

      setSuccess("Invoice created successfully.");
      closeCreateDrawer();
      await loadData();
    } catch (err) {
      console.error(err);

      setError(
        getPlanLimitMessage(err) ??
          (err instanceof Error ? err.message : "Unable to create invoice.")
      );
    } finally {
      setSaving(false);
    }
  }

  async function markAsSent(invoice: Invoice) {
    setError("");
    setSuccess("");

    try {
      const { error: rpcError } = await supabase.rpc(
        "mark_invoice_sent",
        {
          p_invoice_id: invoice.id,
        }
      );

      if (rpcError) {
        throw rpcError;
      }

      setSuccess("Invoice marked as sent.");
      await loadData();

      if (selectedInvoice?.id === invoice.id) {
        setSelectedInvoice({
          ...invoice,
          status: "sent",
          issued_at:
            invoice.issued_at || new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to mark invoice as sent."
      );
    }
  }

  async function recordPayment() {
    setError("");
    setSuccess("");

    if (!selectedInvoice) return;

    const amount = Number(paymentAmount);

    if (!amount || amount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }

    const balance =
      Number(selectedInvoice.total || 0) -
      Number(selectedInvoice.amount_paid || 0);

    if (amount > balance) {
      setError("Payment cannot exceed the outstanding balance.");
      return;
    }

    setSaving(true);

    try {
      const { error: rpcError } = await supabase.rpc(
        "update_invoice_payment",
        {
          p_invoice_id: selectedInvoice.id,
          p_amount: amount,
        }
      );

      if (rpcError) {
        throw rpcError;
      }

      setSuccess("Payment recorded successfully.");
      setPaymentAmount("");
      setShowPaymentBox(false);

      await loadData();

      const newAmountPaid =
        Number(selectedInvoice.amount_paid || 0) + amount;

      setSelectedInvoice({
        ...selectedInvoice,
        amount_paid: newAmountPaid,
        status:
          newAmountPaid >= Number(selectedInvoice.total || 0)
            ? "paid"
            : "partially_paid",
      });
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to record payment."
      );
    } finally {
      setSaving(false);
    }
  }

  function openDetails(invoice: Invoice) {
    setSelectedInvoice(invoice);
    setShowDetailsDrawer(true);
    setShowPaymentBox(false);
    setPaymentAmount("");
    setError("");
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#111827]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
              <FileText className="h-4 w-4" />
              <span>Business Management</span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">
              Invoices
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Create, track, and manage your customer invoices.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              resetCreateForm();
              setShowCreateDrawer(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E84E7] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1E66AA] focus:outline-none focus:ring-2 focus:ring-[#1E84E7] focus:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            New invoice
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Total invoices
            </p>
            <p className="mt-2 text-2xl font-bold text-gray-950">
              {summary.count}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Invoiced
            </p>
            <p className="mt-2 text-2xl font-bold text-gray-950">
              {formatCurrency(summary.total)}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Paid
            </p>
            <p className="mt-2 text-2xl font-bold text-green-600">
              {formatCurrency(summary.paid)}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">
              Outstanding
            </p>
            <p className="mt-2 text-2xl font-bold text-[#1E84E7]">
              {formatCurrency(summary.outstanding)}
            </p>
          </div>
        </section>

        <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search invoice number or customer..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[#1E84E7] focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as
                      | "all"
                      | InvoiceStatus
                  )
                }
                className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-4 pr-10 text-sm font-medium text-gray-700 outline-none transition focus:border-[#1E84E7] focus:bg-white focus:ring-2 focus:ring-indigo-100 sm:min-w-48"
              >
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="partially_paid">
                  Partially Paid
                </option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="space-y-4 p-6">
              {[1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="h-14 animate-pulse rounded-xl bg-gray-100"
                />
              ))}
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50">
                <FileText className="h-7 w-7 text-[#1E84E7]" />
              </div>

              <h2 className="text-lg font-semibold text-gray-950">
                No invoices found
              </h2>

              <p className="mt-1 max-w-md text-sm text-gray-500">
                Create your first invoice to start tracking
                customer billing.
              </p>

              <button
                type="button"
                onClick={() => {
                  resetCreateForm();
                  setShowCreateDrawer(true);
                }}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#1E84E7] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1E66AA]"
              >
                <Plus className="h-4 w-4" />
                Create invoice
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="mobile-card-table min-w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/70 text-left">
                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Invoice
                    </th>

                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Customer
                    </th>

                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Date
                    </th>

                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Due
                    </th>

                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Amount
                    </th>

                    <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Status
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredInvoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="transition hover:bg-gray-50"
                    >
                      <td className="px-5 py-4" data-label="Invoice">
                        <button
                          type="button"
                          onClick={() => openDetails(invoice)}
                          className="font-semibold text-[#1E84E7] hover:text-[#1E66AA]"
                        >
                          {invoice.invoice_number}
                        </button>
                      </td>

                      <td className="px-5 py-4" data-label="Customer">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                            <User className="h-4 w-4 text-gray-500" />
                          </div>

                          <span className="text-sm font-medium text-gray-800">
                            {getCustomerName(
                              invoice.customers
                            )}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600" data-label="Date">
                        {formatDate(
                          invoice.issued_at ||
                            invoice.created_at
                        )}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600" data-label="Due">
                        {formatDate(invoice.due_date)}
                      </td>

                      <td className="px-5 py-4" data-label="Amount">
                        <div className="font-semibold text-gray-900">
                          {formatCurrency(
                            Number(invoice.total || 0)
                          )}
                        </div>

                        {Number(invoice.amount_paid || 0) <
                          Number(invoice.total || 0) && (
                          <div className="mt-1 text-xs text-gray-500">
                            Balance{" "}
                            {formatCurrency(
                              Number(invoice.total || 0) -
                                Number(
                                  invoice.amount_paid || 0
                                )
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4" data-label="Status">
                        <span
                          className={
                            "inline-flex rounded-full px-3 py-1 text-xs font-semibold " +
                            statusClasses(invoice.status)
                          }
                        >
                          {statusLabel(invoice.status)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right" data-label="Action">
                        <button
                          type="button"
                          onClick={() => openDetails(invoice)}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {showCreateDrawer && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-gray-950/40 backdrop-blur-sm"
            onClick={closeCreateDrawer}
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-gray-950">
                  New invoice
                </h2>

                <p className="text-sm text-gray-500">
                  Add items and billing information.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreateDrawer}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {error && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="mb-5">
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Customer
                </label>

                <select
                  value={customerId}
                  onChange={(event) =>
                    setCustomerId(event.target.value)
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#1E84E7] focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">
                    Walk-in customer
                  </option>

                  {customers.map((customer) => (
                    <option
                      key={customer.id}
                      value={customer.id}
                    >
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-6 rounded-2xl border border-gray-200 p-4">
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-950">
                    Invoice items
                  </h3>

                  <p className="mt-1 text-xs text-gray-500">
                    Products reduce inventory when the invoice
                    is created.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_100px_auto]">
                  <select
                    value={selectedProduct}
                    onChange={(event) =>
                      setSelectedProduct(event.target.value)
                    }
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1E84E7] focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">
                      Select product/service
                    </option>

                    {products.map((product) => (
                      <option
                        key={product.id}
                        value={product.id}
                      >
                        {product.name} —{" "}
                        {formatCurrency(
                          Number(product.selling_price || 0)
                        )}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(event) =>
                      setQuantity(event.target.value)
                    }
                    className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#1E84E7] focus:ring-2 focus:ring-indigo-100"
                    placeholder="Qty"
                  />

                  <button
                    type="button"
                    onClick={addItemToCart}
                    className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
                  >
                    Add
                  </button>
                </div>

                {cart.length > 0 && (
                  <div className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-100">
                    {cart.map((item) => (
                      <div
                        key={item.product_id}
                        className="flex items-center gap-3 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {item.name}
                          </p>

                          <p className="text-xs text-gray-500">
                            {formatCurrency(item.unit_price)} each
                          </p>
                        </div>

                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(event) =>
                            updateItemQuantity(
                              item.product_id,
                              Number(event.target.value)
                            )
                          }
                          className="w-20 rounded-lg border border-gray-200 px-2 py-2 text-center text-sm outline-none focus:border-[#1E84E7]"
                        />

                        <p className="w-24 text-right text-sm font-semibold text-gray-900">
                          {formatCurrency(
                            item.quantity * item.unit_price
                          )}
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            removeItem(item.product_id)
                          }
                          className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mb-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Due date
                  </label>

                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                    <input
                      type="date"
                      value={dueDate}
                      onChange={(event) =>
                        setDueDate(event.target.value)
                      }
                      className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-[#1E84E7] focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Notes
                  </label>

                  <input
                    type="text"
                    value={notes}
                    onChange={(event) =>
                      setNotes(event.target.value)
                    }
                    placeholder="Optional note"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#1E84E7] focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              <div className="mb-6 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Discount
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discount}
                    onChange={(event) =>
                      setDiscount(event.target.value)
                    }
                    placeholder="0"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#1E84E7] focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Tax
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={tax}
                    onChange={(event) =>
                      setTax(event.target.value)
                    }
                    placeholder="0"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-[#1E84E7] focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-gray-50 p-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    Subtotal
                  </span>

                  <span className="font-medium text-gray-900">
                    {formatCurrency(subtotal)}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    Discount
                  </span>

                  <span className="font-medium text-gray-900">
                    -{formatCurrency(discountAmount)}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-gray-500">Tax</span>

                  <span className="font-medium text-gray-900">
                    {formatCurrency(taxAmount)}
                  </span>
                </div>

                <div className="my-4 border-t border-gray-200" />

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-950">
                    Total
                  </span>

                  <span className="text-2xl font-bold text-[#1E84E7]">
                    {formatCurrency(invoiceTotal)}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 bg-white p-5">
              <button
                type="button"
                onClick={createInvoice}
                disabled={saving || cart.length === 0}
                className="w-full rounded-xl bg-[#1E84E7] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#1E66AA] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Creating invoice..." : "Create invoice"}
              </button>
            </div>
          </aside>
        </div>
      )}

      {showDetailsDrawer && selectedInvoice && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-gray-950/40 backdrop-blur-sm"
            onClick={() => setShowDetailsDrawer(false)}
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Invoice
                </p>

                <h2 className="text-xl font-bold text-gray-950">
                  {selectedInvoice.invoice_number}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowDetailsDrawer(false)
                }
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {error && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="mb-6 flex items-center justify-between">
                <span
                  className={
                    "inline-flex rounded-full px-3 py-1 text-xs font-semibold " +
                    statusClasses(selectedInvoice.status)
                  }
                >
                  {statusLabel(selectedInvoice.status)}
                </span>

                <span className="text-sm text-gray-500">
                  {formatDate(
                    selectedInvoice.issued_at ||
                      selectedInvoice.created_at
                  )}
                </span>
              </div>

              <div className="mb-6 rounded-2xl border border-gray-200 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Customer
                </p>

                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50">
                    <User className="h-5 w-5 text-[#1E84E7]" />
                  </div>

                  <div>
                    <p className="font-semibold text-gray-950">
                      {getCustomerName(
                        selectedInvoice.customers
                      )}
                    </p>

                    {Array.isArray(
                      selectedInvoice.customers
                    ) ? (
                      <p className="text-sm text-gray-500">
                        {selectedInvoice.customers[0]?.email ||
                          selectedInvoice.customers[0]?.phone ||
                          ""}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500">
                        {selectedInvoice.customers?.email ||
                          selectedInvoice.customers?.phone ||
                          ""}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-6 rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    Invoice total
                  </span>

                  <span className="text-xl font-bold text-gray-950">
                    {formatCurrency(
                      Number(selectedInvoice.total || 0)
                    )}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    Amount paid
                  </span>

                  <span className="font-semibold text-green-600">
                    {formatCurrency(
                      Number(
                        selectedInvoice.amount_paid || 0
                      )
                    )}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    Balance
                  </span>

                  <span className="font-semibold text-[#1E84E7]">
                    {formatCurrency(
                      Math.max(
                        Number(selectedInvoice.total || 0) -
                          Number(
                            selectedInvoice.amount_paid || 0
                          ),
                        0
                      )
                    )}
                  </span>
                </div>

                <div className="my-4 border-t border-gray-100" />

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    Due date
                  </span>

                  <span className="font-medium text-gray-800">
                    {formatDate(
                      selectedInvoice.due_date
                    )}
                  </span>
                </div>
              </div>

              {showPaymentBox && (
                <div className="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                  <label className="mb-2 block text-sm font-semibold text-gray-800">
                    Payment amount
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentAmount}
                    onChange={(event) =>
                      setPaymentAmount(event.target.value)
                    }
                    placeholder="Enter amount"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#1E84E7] focus:ring-2 focus:ring-indigo-100"
                  />

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={recordPayment}
                      disabled={saving}
                      className="flex-1 rounded-xl bg-[#1E84E7] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1E66AA] disabled:opacity-50"
                    >
                      {saving
                        ? "Saving..."
                        : "Record payment"}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setShowPaymentBox(false)
                      }
                      className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 bg-white p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {selectedInvoice.status !== "sent" &&
                  selectedInvoice.status !== "paid" &&
                  selectedInvoice.status !==
                    "partially_paid" &&
                  selectedInvoice.status !== "cancelled" && (
                    <button
                      type="button"
                      onClick={() =>
                        markAsSent(selectedInvoice)
                      }
                      className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                    >
                      Mark as sent
                    </button>
                  )}

                {selectedInvoice.status !== "paid" &&
                  selectedInvoice.status !== "cancelled" &&
                  Number(selectedInvoice.total || 0) >
                    Number(
                      selectedInvoice.amount_paid || 0
                    ) && (
                    <button
                      type="button"
                      onClick={() =>
                        setShowPaymentBox(true)
                      }
                      className="rounded-xl bg-[#1E84E7] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1E66AA]"
                    >
                      Record payment
                    </button>
                  )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}