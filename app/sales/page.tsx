"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/error-message";
import { getPlanLimitMessage } from "@/lib/billing/errors";
import {
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  FileText,
  Plus,
  Search,
  ShoppingCart,
  User,
  X,
} from "lucide-react";

type Product = {
  id: string;
  name: string;
  item_type: "product" | "service";
  sku: string | null;
  selling_price: number;
  stock_quantity: number;
  is_active: boolean;
};

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

type Sale = {
  id: string;
  sale_number: string;
  customer_id: string | null;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: string;
  payment_status: string;
  notes: string | null;
  sold_at: string;
};

type CartItem = {
  product: Product;
  quantity: number;
};

const paymentMethods = [
  { value: "cash", label: "Cash" },
  { value: "transfer", label: "Transfer" },
  { value: "pos", label: "POS" },
  { value: "credit", label: "Credit" },
  { value: "other", label: "Other" },
];

const paymentStatuses = [
  { value: "paid", label: "Paid" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "unpaid", label: "Unpaid" },
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
    timeStyle: "short",
  }).format(new Date(value));
}

function getPaymentMethodLabel(value: string) {
  return (
    paymentMethods.find((method) => method.value === value)?.label ??
    value
  );
}

function getPaymentStatusLabel(value: string) {
  return (
    paymentStatuses.find((status) => status.value === value)?.label ??
    value
  );
}

export default function SalesPage() {
  const supabase = createClient();

  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [businessId, setBusinessId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showDrawer, setShowDrawer] = useState(false);

  const [selectedCustomer, setSelectedCustomer] =
    useState<string>("");

  const [cart, setCart] = useState<CartItem[]>([]);

  const [productSearch, setProductSearch] = useState("");

  const [discount, setDiscount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [notes, setNotes] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadSalesData();
  }, []);

  async function loadSalesData() {
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

      setBusinessId(membership.business_id);

      const [
        { data: salesData, error: salesError },
        { data: productsData, error: productsError },
        { data: customersData, error: customersError },
      ] = await Promise.all([
        supabase
          .from("sales")
          .select(
            "id, sale_number, customer_id, subtotal, discount, total, payment_method, payment_status, notes, sold_at"
          )
          .eq("business_id", membership.business_id)
          .order("sold_at", { ascending: false }),

        supabase
          .from("products")
          .select(
            "id, name, item_type, sku, selling_price, stock_quantity, is_active"
          )
          .eq("business_id", membership.business_id)
          .eq("is_active", true)
          .order("name", { ascending: true }),

        supabase
          .from("customers")
          .select("id, name, phone, email")
          .eq("business_id", membership.business_id)
          .order("name", { ascending: true }),
      ]);

      if (salesError) throw salesError;
      if (productsError) throw productsError;
      if (customersError) throw customersError;

      setSales(salesData ?? []);
      setProducts(productsData ?? []);
      setCustomers(customersData ?? []);
    } catch (err) {
      console.error(err);
      setError("We couldn't load your sales data.");
    } finally {
      setLoading(false);
    }
  }

  const customerMap = useMemo(() => {
    return new Map(customers.map((customer) => [customer.id, customer]));
  }, [customers]);

  const filteredSales = useMemo(() => {
    const query = search.trim().toLowerCase();

    return sales.filter((sale) => {
      const customer = sale.customer_id
        ? customerMap.get(sale.customer_id)
        : null;

      const matchesSearch =
        !query ||
        sale.sale_number.toLowerCase().includes(query) ||
        customer?.name.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        sale.payment_status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [sales, search, statusFilter, customerMap]);

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();

    if (!query) {
      return products;
    }

    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.sku?.toLowerCase().includes(query)
    );
  }, [products, productSearch]);

  const subtotal = useMemo(() => {
    return cart.reduce(
      (sum, item) =>
        sum + Number(item.product.selling_price) * item.quantity,
      0
    );
  }, [cart]);

  const discountAmount = Math.max(Number(discount) || 0, 0);

  const total = Math.max(subtotal - discountAmount, 0);

  function addToCart(product: Product) {
    setError("");

    setCart((current) => {
      const existing = current.find(
        (item) => item.product.id === product.id
      );

      if (existing) {
        return current.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        );
      }

      return [
        ...current,
        {
          product,
          quantity: 1,
        },
      ];
    });
  }

  function updateQuantity(productId: string, quantity: number) {
    if (quantity <= 0) {
      setCart((current) =>
        current.filter((item) => item.product.id !== productId)
      );
      return;
    }

    setCart((current) =>
      current.map((item) =>
        item.product.id === productId
          ? {
              ...item,
              quantity,
            }
          : item
      )
    );
  }

  function removeFromCart(productId: string) {
    setCart((current) =>
      current.filter((item) => item.product.id !== productId)
    );
  }

  function resetSaleForm() {
    setSelectedCustomer("");
    setCart([]);
    setProductSearch("");
    setDiscount("");
    setPaymentMethod("cash");
    setPaymentStatus("paid");
    setNotes("");
    setError("");
  }

  async function createSale() {
    if (!businessId) {
      setError("Business information is missing.");
      return;
    }

    if (cart.length === 0) {
      setError("Add at least one product or service.");
      return;
    }

    if (discountAmount > subtotal) {
      setError("Discount cannot be greater than the subtotal.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const items = cart.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
      }));

      const { error: saleError } = await supabase.rpc("create_sale", {
        p_business_id: businessId,
        p_customer_id: selectedCustomer || null,
        p_items: items,
        p_discount: discountAmount,
        p_payment_method: paymentMethod,
        p_payment_status: paymentStatus,
        p_notes: notes.trim() || null,
      });

      if (saleError) {
        throw saleError;
      }

      setSuccess("Sale recorded successfully.");

      resetSaleForm();
      setShowDrawer(false);

      await loadSalesData();

      setTimeout(() => {
        setSuccess("");
      }, 4000);
    } catch (err: unknown) {
      console.error(err);
      setError(
        getPlanLimitMessage(err) ??
          getErrorMessage(err, "We couldn't record this sale.")
      );
    } finally {
      setSaving(false);
    }
  }

  const totalRevenue = sales.reduce(
    (sum, sale) => sum + Number(sale.total),
    0
  );

  const paidSales = sales.filter(
    (sale) => sale.payment_status === "paid"
  ).length;

  const unpaidSales = sales.filter(
    (sale) => sale.payment_status === "unpaid"
  ).length;

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#111827]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm text-[#6B7280]">
              <ShoppingCart className="h-4 w-4" />
              Sales
            </div>

            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Sales
            </h1>

            <p className="mt-1 text-sm text-[#6B7280]">
              Record and manage your business transactions.
            </p>
          </div>

          <button
            onClick={() => {
              resetSaleForm();
              setShowDrawer(true);
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#1E84E7] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1E66AA] focus:outline-none focus:ring-4 focus:ring-indigo-100"
          >
            <Plus className="h-4 w-4" />
            New sale
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

        {/* Summary */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-[#1E84E7]">
              <CircleDollarSign className="h-5 w-5" />
            </div>

            <p className="text-sm text-[#6B7280]">Total revenue</p>

            <p className="mt-1 text-2xl font-semibold">
              {formatCurrency(totalRevenue)}
            </p>
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-600">
              <FileText className="h-5 w-5" />
            </div>

            <p className="text-sm text-[#6B7280]">Total sales</p>

            <p className="mt-1 text-2xl font-semibold">
              {sales.length}
            </p>
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <CreditCard className="h-5 w-5" />
            </div>

            <p className="text-sm text-[#6B7280]">Paid sales</p>

            <p className="mt-1 text-2xl font-semibold">
              {paidSales}
            </p>
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <CalendarDays className="h-5 w-5" />
            </div>

            <p className="text-sm text-[#6B7280]">Unpaid sales</p>

            <p className="mt-1 text-2xl font-semibold">
              {unpaidSales}
            </p>
          </div>
        </div>

        {/* Sales table */}
        <section className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
          <div className="border-b border-[#E5E7EB] p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />

                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search sales or customers..."
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] pl-10 pr-4 text-sm outline-none transition focus:border-[#1E84E7] focus:ring-4 focus:ring-indigo-50"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-11 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm outline-none focus:border-[#1E84E7] focus:ring-4 focus:ring-indigo-50"
              >
                <option value="all">All statuses</option>
                <option value="paid">Paid</option>
                <option value="partially_paid">
                  Partially paid
                </option>
                <option value="unpaid">Unpaid</option>
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
          ) : filteredSales.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-[#1E84E7]">
                <ShoppingCart className="h-6 w-6" />
              </div>

              <h3 className="text-base font-semibold">
                No sales yet
              </h3>

              <p className="mx-auto mt-1 max-w-sm text-sm text-[#6B7280]">
                Record your first sale to start tracking revenue
                and business performance.
              </p>

              <button
                onClick={() => {
                  resetSaleForm();
                  setShowDrawer(true);
                }}
                className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#1E84E7] px-4 text-sm font-semibold text-white hover:bg-[#1E66AA]"
              >
                <Plus className="h-4 w-4" />
                Record sale
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="mobile-card-table w-full min-w-[850px] text-left">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                    <th className="px-5 py-4">Sale</th>
                    <th className="px-5 py-4">Customer</th>
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4">Payment</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">
                      Amount
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredSales.map((sale) => {
                    const customer = sale.customer_id
                      ? customerMap.get(sale.customer_id)
                      : null;

                    return (
                      <tr
                        key={sale.id}
                        className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#FAFAFA]"
                      >
                        <td className="px-5 py-4" data-label="Sale">
                          <span className="font-semibold">
                            {sale.sale_number}
                          </span>
                        </td>

                        <td className="px-5 py-4" data-label="Customer">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-[#1E84E7]">
                              <User className="h-4 w-4" />
                            </div>

                            <span className="text-sm">
                              {customer?.name ?? "Walk-in customer"}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-[#6B7280]" data-label="Date">
                          {formatDate(sale.sold_at)}
                        </td>

                        <td className="px-5 py-4 text-sm" data-label="Payment">
                          {getPaymentMethodLabel(
                            sale.payment_method
                          )}
                        </td>

                        <td className="px-5 py-4" data-label="Status">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              sale.payment_status === "paid"
                                ? "bg-green-50 text-green-700"
                                : sale.payment_status ===
                                    "partially_paid"
                                  ? "bg-orange-50 text-orange-700"
                                  : "bg-red-50 text-red-700"
                            }`}
                          >
                            {getPaymentStatusLabel(
                              sale.payment_status
                            )}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right text-sm font-semibold" data-label="Amount">
                          {formatCurrency(Number(sale.total))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* New Sale Drawer */}
      {showDrawer && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            onClick={() => !saving && setShowDrawer(false)}
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
            {/* Drawer header */}
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">
                  New sale
                </h2>

                <p className="text-sm text-[#6B7280]">
                  Record a customer transaction.
                </p>
              </div>

              <button
                onClick={() => setShowDrawer(false)}
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer body */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {error && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              {/* Customer */}
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium">
                  Customer
                </label>

                <select
                  value={selectedCustomer}
                  onChange={(e) =>
                    setSelectedCustomer(e.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#1E84E7] focus:ring-4 focus:ring-indigo-50"
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
                      {customer.phone
                        ? ` — ${customer.phone}`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Products */}
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium">
                    Products & services
                  </label>

                  <span className="text-xs text-[#6B7280]">
                    {cart.length}{" "}
                    {cart.length === 1 ? "item" : "items"}
                  </span>
                </div>

                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />

                  <input
                    value={productSearch}
                    onChange={(e) =>
                      setProductSearch(e.target.value)
                    }
                    placeholder="Search products or services..."
                    className="h-11 w-full rounded-xl border border-[#E5E7EB] pl-10 pr-4 text-sm outline-none focus:border-[#1E84E7] focus:ring-4 focus:ring-indigo-50"
                  />
                </div>

                <div className="max-h-52 space-y-2 overflow-y-auto rounded-xl border border-[#E5E7EB] p-2">
                  {filteredProducts.length === 0 ? (
                    <div className="py-8 text-center text-sm text-[#6B7280]">
                      No products or services found.
                    </div>
                  ) : (
                    filteredProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addToCart(product)}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left transition hover:bg-indigo-50"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {product.name}
                          </p>

                          <p className="mt-0.5 text-xs text-[#6B7280]">
                            {product.item_type === "service"
                              ? "Service"
                              : `Stock: ${product.stock_quantity}`}
                            {product.sku
                              ? ` · ${product.sku}`
                              : ""}
                          </p>
                        </div>

                        <span className="text-sm font-semibold text-[#1E84E7]">
                          {formatCurrency(
                            Number(product.selling_price)
                          )}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Cart */}
              {cart.length > 0 && (
                <div className="mb-6">
                  <h3 className="mb-3 text-sm font-medium">
                    Sale items
                  </h3>

                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div
                        key={item.product.id}
                        className="rounded-xl border border-[#E5E7EB] p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {item.product.name}
                            </p>

                            <p className="mt-1 text-xs text-[#6B7280]">
                              {formatCurrency(
                                Number(
                                  item.product.selling_price
                                )
                              )}{" "}
                              each
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeFromCart(item.product.id)
                            }
                            className="text-xs font-medium text-red-600 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center rounded-lg border border-[#E5E7EB]">
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(
                                  item.product.id,
                                  item.quantity - 1
                                )
                              }
                              className="h-9 w-9 text-lg text-[#6B7280] hover:bg-[#F9FAFB]"
                            >
                              −
                            </button>

                            <span className="w-10 text-center text-sm font-semibold">
                              {item.quantity}
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(
                                  item.product.id,
                                  item.quantity + 1
                                )
                              }
                              className="h-9 w-9 text-lg text-[#6B7280] hover:bg-[#F9FAFB]"
                            >
                              +
                            </button>
                          </div>

                          <span className="text-sm font-semibold">
                            {formatCurrency(
                              Number(
                                item.product.selling_price
                              ) * item.quantity
                            )}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Discount */}
              <div className="mb-5">
                <label className="mb-2 block text-sm font-medium">
                  Discount
                </label>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B7280]">
                    ₦
                  </span>

                  <input
                    type="number"
                    min="0"
                    value={discount}
                    onChange={(e) =>
                      setDiscount(e.target.value)
                    }
                    placeholder="0"
                    className="h-11 w-full rounded-xl border border-[#E5E7EB] pl-8 pr-4 text-sm outline-none focus:border-[#1E84E7] focus:ring-4 focus:ring-indigo-50"
                  />
                </div>
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

              {/* Payment status */}
              <div className="mb-5">
                <label className="mb-2 block text-sm font-medium">
                  Payment status
                </label>

                <select
                  value={paymentStatus}
                  onChange={(e) =>
                    setPaymentStatus(e.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm outline-none focus:border-[#1E84E7] focus:ring-4 focus:ring-indigo-50"
                >
                  {paymentStatuses.map((status) => (
                    <option
                      key={status.value}
                      value={status.value}
                    >
                      {status.label}
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
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Add any notes about this sale..."
                  className="w-full resize-none rounded-xl border border-[#E5E7EB] px-3 py-3 text-sm outline-none focus:border-[#1E84E7] focus:ring-4 focus:ring-indigo-50"
                />
              </div>

              {/* Summary */}
              <div className="rounded-2xl bg-[#F8FAFC] p-4">
                <div className="flex justify-between py-1.5 text-sm">
                  <span className="text-[#6B7280]">
                    Subtotal
                  </span>

                  <span className="font-medium">
                    {formatCurrency(subtotal)}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 text-sm">
                  <span className="text-[#6B7280]">
                    Discount
                  </span>

                  <span className="font-medium">
                    − {formatCurrency(discountAmount)}
                  </span>
                </div>

                <div className="my-2 border-t border-[#E5E7EB]" />

                <div className="flex justify-between py-1.5">
                  <span className="font-semibold">
                    Total
                  </span>

                  <span className="text-xl font-bold text-[#1E84E7]">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Drawer footer */}
            <div className="border-t border-[#E5E7EB] bg-white px-5 py-4">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDrawer(false)}
                  disabled={saving}
                  className="h-11 flex-1 rounded-xl border border-[#E5E7EB] px-4 text-sm font-semibold text-[#374151] hover:bg-[#F9FAFB]"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={createSale}
                  disabled={saving || cart.length === 0}
                  className="h-11 flex-1 rounded-xl bg-[#1E84E7] px-4 text-sm font-semibold text-white transition hover:bg-[#1E66AA] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Recording..." : "Record sale"}
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}