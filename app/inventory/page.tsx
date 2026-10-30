"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/error-message";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  ChevronRight,
  Package,
  Plus,
  Search,
  X,
} from "lucide-react";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  selling_price: number;
  purchase_cost: number;
  stock_quantity: number;
  low_stock_threshold: number;
  supplier: string | null;
  is_active: boolean;
};

type Movement = {
  id: string;
  movement_type: string;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  note: string | null;
  created_at: string;
};

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

function getStockStatus(product: Product) {
  const stock = Number(product.stock_quantity);
  const threshold = Number(product.low_stock_threshold);

  if (stock <= 0) {
    return {
      label: "Out of stock",
      className: "bg-red-50 text-red-700",
    };
  }

  if (stock <= threshold) {
    return {
      label: "Low stock",
      className: "bg-orange-50 text-orange-700",
    };
  }

  return {
    label: "In stock",
    className: "bg-green-50 text-green-700",
  };
}

function getMovementLabel(type: string) {
  switch (type) {
    case "stock_in":
      return "Stock in";
    case "stock_out":
      return "Stock out";
    case "sale":
      return "Sale";
    case "adjustment":
      return "Adjustment";
    default:
      return type;
  }
}

export default function InventoryPage() {
  const supabase = createClient();

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showDrawer, setShowDrawer] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [selectedProduct, setSelectedProduct] =
    useState<Product | null>(null);

  const [movementType, setMovementType] =
    useState("stock_in");

  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  const [movements, setMovements] = useState<Movement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadInventory();
  }, []);

  async function loadInventory() {
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

      const { data, error: productsError } = await supabase
        .from("products")
        .select(
          "id, name, sku, selling_price, purchase_cost, stock_quantity, low_stock_threshold, supplier, is_active"
        )
        .eq("business_id", membership.business_id)
        .eq("item_type", "product")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (productsError) {
        throw productsError;
      }

      setProducts(data ?? []);
    } catch (err) {
      console.error(err);
      setError("We couldn't load your inventory.");
    } finally {
      setLoading(false);
    }
  }

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const stock = Number(product.stock_quantity);
      const threshold = Number(product.low_stock_threshold);

      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.sku?.toLowerCase().includes(query) ||
        product.supplier?.toLowerCase().includes(query);

      let matchesStatus = true;

      if (statusFilter === "in_stock") {
        matchesStatus = stock > threshold;
      }

      if (statusFilter === "low_stock") {
        matchesStatus = stock > 0 && stock <= threshold;
      }

      if (statusFilter === "out_of_stock") {
        matchesStatus = stock <= 0;
      }

      return matchesSearch && matchesStatus;
    });
  }, [products, search, statusFilter]);

  const totalInventoryValue = products.reduce(
    (sum, product) =>
      sum +
      Number(product.purchase_cost) *
        Number(product.stock_quantity),
    0
  );

  const lowStockCount = products.filter(
    (product) =>
      Number(product.stock_quantity) > 0 &&
      Number(product.stock_quantity) <=
        Number(product.low_stock_threshold)
  ).length;

  const outOfStockCount = products.filter(
    (product) => Number(product.stock_quantity) <= 0
  ).length;

  function openMovementDrawer(product: Product) {
    setSelectedProduct(product);
    setMovementType("stock_in");
    setQuantity("");
    setNote("");
    setError("");
    setShowDrawer(true);
  }

  async function submitMovement() {
    if (!businessId || !selectedProduct) {
      setError("Inventory information is missing.");
      return;
    }

    const numericQuantity = Number(quantity);

    if (!numericQuantity || numericQuantity <= 0) {
      setError("Enter a quantity greater than zero.");
      return;
    }

    if (
      movementType === "stock_out" &&
      numericQuantity >
        Number(selectedProduct.stock_quantity)
    ) {
      setError("You cannot remove more stock than is available.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const { error: movementError } =
        await supabase.rpc("adjust_inventory", {
          p_business_id: businessId,
          p_product_id: selectedProduct.id,
          p_movement_type: movementType,
          p_quantity: numericQuantity,
          p_note: note.trim() || null,
        });

      if (movementError) {
        throw movementError;
      }

      setSuccess(
        movementType === "stock_in"
          ? "Stock added successfully."
          : movementType === "stock_out"
            ? "Stock removed successfully."
            : "Inventory adjusted successfully."
      );

      setShowDrawer(false);

      await loadInventory();

      setTimeout(() => {
        setSuccess("");
      }, 4000);
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, "We couldn't update the inventory."));
    } finally {
      setSaving(false);
    }
  }

  async function openHistory(product: Product) {
    if (!businessId) return;

    setSelectedProduct(product);
    setShowHistory(true);
    setHistoryLoading(true);
    setMovements([]);
    setError("");

    try {
      const { data, error: movementError } =
        await supabase
          .from("inventory_movements")
          .select(
            "id, movement_type, quantity, previous_quantity, new_quantity, note, created_at"
          )
          .eq("business_id", businessId)
          .eq("product_id", product.id)
          .order("created_at", { ascending: false })
          .limit(50);

      if (movementError) {
        throw movementError;
      }

      setMovements(data ?? []);
    } catch (err) {
      console.error(err);
      setError("We couldn't load the stock history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#111827]">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm text-[#6B7280]">
              <Boxes className="h-4 w-4" />
              Inventory
            </div>

            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Inventory
            </h1>

            <p className="mt-1 text-sm text-[#6B7280]">
              Monitor stock levels and keep your products moving.
            </p>
          </div>
        </div>

        {/* Success */}
        {success && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            {success}
          </div>
        )}

        {/* Error */}
        {error && !showDrawer && !showHistory && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Summary */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-[#1E84E7]">
              <Package className="h-5 w-5" />
            </div>

            <p className="text-sm text-[#6B7280]">
              Total products
            </p>

            <p className="mt-1 text-2xl font-semibold">
              {products.length}
            </p>
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
            </div>

            <p className="text-sm text-[#6B7280]">
              Low stock
            </p>

            <p className="mt-1 text-2xl font-semibold">
              {lowStockCount}
            </p>
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <Boxes className="h-5 w-5" />
            </div>

            <p className="text-sm text-[#6B7280]">
              Out of stock
            </p>

            <p className="mt-1 text-2xl font-semibold">
              {outOfStockCount}
            </p>
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-600">
              <Package className="h-5 w-5" />
            </div>

            <p className="text-sm text-[#6B7280]">
              Inventory value
            </p>

            <p className="mt-1 text-2xl font-semibold">
              {formatCurrency(totalInventoryValue)}
            </p>

            <p className="mt-1 text-xs text-[#9CA3AF]">
              Based on purchase cost
            </p>
          </div>

        </div>

        {/* Inventory table */}
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
                  placeholder="Search products or SKU..."
                  className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] pl-10 pr-4 text-sm outline-none transition focus:border-[#1E84E7] focus:ring-4 focus:ring-indigo-50"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value)
                }
                className="h-11 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm outline-none focus:border-[#1E84E7] focus:ring-4 focus:ring-indigo-50"
              >
                <option value="all">All stock</option>
                <option value="in_stock">In stock</option>
                <option value="low_stock">Low stock</option>
                <option value="out_of_stock">
                  Out of stock
                </option>
              </select>

            </div>

          </div>

          {loading ? (
            <div className="space-y-4 p-6">
              {[1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="h-16 animate-pulse rounded-xl bg-[#F3F4F6]"
                />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (

            <div className="px-6 py-16 text-center">

              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-[#1E84E7]">
                <Package className="h-6 w-6" />
              </div>

              <h3 className="text-base font-semibold">
                No inventory items found
              </h3>

              <p className="mx-auto mt-1 max-w-sm text-sm text-[#6B7280]">
                Add a product from Products to start managing
                your inventory.
              </p>

            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="mobile-card-table w-full min-w-[950px] text-left">

                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-xs font-semibold uppercase tracking-wide text-[#6B7280]">

                    <th className="px-5 py-4">
                      Product
                    </th>

                    <th className="px-5 py-4">
                      SKU
                    </th>

                    <th className="px-5 py-4">
                      Current stock
                    </th>

                    <th className="px-5 py-4">
                      Status
                    </th>

                    <th className="px-5 py-4">
                      Selling price
                    </th>

                    <th className="px-5 py-4">
                      Inventory value
                    </th>

                    <th className="px-5 py-4 text-right">
                      Actions
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {filteredProducts.map((product) => {
                    const status =
                      getStockStatus(product);

                    const inventoryValue =
                      Number(product.purchase_cost) *
                      Number(product.stock_quantity);

                    return (
                      <tr
                        key={product.id}
                        className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#FAFAFA]"
                      >

                        <td className="px-5 py-4" data-label="Product">

                          <div className="flex items-center gap-3">

                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-[#1E84E7]">
                              <Package className="h-5 w-5" />
                            </div>

                            <div>
                              <p className="text-sm font-semibold">
                                {product.name}
                              </p>

                              {product.supplier && (
                                <p className="mt-0.5 text-xs text-[#9CA3AF]">
                                  {product.supplier}
                                </p>
                              )}
                            </div>

                          </div>

                        </td>

                        <td className="px-5 py-4 text-sm text-[#6B7280]" data-label="SKU">
                          {product.sku ?? "—"}
                        </td>

                        <td className="px-5 py-4" data-label="Current stock">

                          <span className="text-sm font-semibold">
                            {Number(
                              product.stock_quantity
                            )}
                          </span>

                          <span className="ml-1 text-xs text-[#9CA3AF]">
                            / threshold{" "}
                            {Number(
                              product.low_stock_threshold
                            )}
                          </span>

                        </td>

                        <td className="px-5 py-4" data-label="Status">

                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}
                          >
                            {status.label}
                          </span>

                        </td>

                        <td className="px-5 py-4 text-sm font-medium" data-label="Selling price">
                          {formatCurrency(
                            Number(product.selling_price)
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm font-medium" data-label="Inventory value">
                          {formatCurrency(inventoryValue)}
                        </td>

                        <td className="px-5 py-4" data-label="Actions">

                          <div className="flex items-center justify-end gap-2">

                            <button
                              onClick={() =>
                                openMovementDrawer(
                                  product
                                )
                              }
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1E84E7] px-3 text-xs font-semibold text-white hover:bg-[#1E66AA]"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Adjust
                            </button>

                            <button
                              onClick={() =>
                                openHistory(product)
                              }
                              className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#E5E7EB] px-3 text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB]"
                            >
                              History
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>

                          </div>

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

      {/* Stock adjustment drawer */}
      {showDrawer && selectedProduct && (

        <div className="fixed inset-0 z-50">

          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            onClick={() =>
              !saving && setShowDrawer(false)
            }
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">

              <div>
                <h2 className="text-lg font-semibold">
                  Adjust inventory
                </h2>

                <p className="text-sm text-[#6B7280]">
                  {selectedProduct.name}
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

            <div className="flex-1 overflow-y-auto px-5 py-5">

              {error && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              <div className="mb-6 rounded-2xl bg-[#F8FAFC] p-4">

                <p className="text-sm text-[#6B7280]">
                  Current stock
                </p>

                <p className="mt-1 text-3xl font-bold">
                  {Number(
                    selectedProduct.stock_quantity
                  )}
                </p>

              </div>

              <div className="mb-5">

                <label className="mb-2 block text-sm font-medium">
                  Movement
                </label>

                <div className="grid grid-cols-2 gap-3">

                  <button
                    type="button"
                    onClick={() =>
                      setMovementType("stock_in")
                    }
                    className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                      movementType === "stock_in"
                        ? "border-[#1E84E7] bg-indigo-50 text-[#1E84E7]"
                        : "border-[#E5E7EB] hover:bg-[#F9FAFB]"
                    }`}
                  >
                    <ArrowDownToLine className="h-5 w-5" />

                    <div>
                      <p className="text-sm font-semibold">
                        Stock in
                      </p>

                      <p className="text-xs opacity-70">
                        Add stock
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setMovementType("stock_out")
                    }
                    className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${
                      movementType === "stock_out"
                        ? "border-red-500 bg-red-50 text-red-600"
                        : "border-[#E5E7EB] hover:bg-[#F9FAFB]"
                    }`}
                  >
                    <ArrowUpFromLine className="h-5 w-5" />

                    <div>
                      <p className="text-sm font-semibold">
                        Stock out
                      </p>

                      <p className="text-xs opacity-70">
                        Remove stock
                      </p>
                    </div>
                  </button>

                </div>

              </div>

              <div className="mb-5">

                <label className="mb-2 block text-sm font-medium">
                  Quantity
                </label>

                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(e.target.value)
                  }
                  placeholder="Enter quantity"
                  className="h-12 w-full rounded-xl border border-[#E5E7EB] px-4 text-sm outline-none focus:border-[#1E84E7] focus:ring-4 focus:ring-indigo-50"
                />

              </div>

              <div className="mb-6">

                <label className="mb-2 block text-sm font-medium">
                  Note
                  <span className="ml-1 font-normal text-[#9CA3AF]">
                    (optional)
                  </span>
                </label>

                <textarea
                  value={note}
                  onChange={(e) =>
                    setNote(e.target.value)
                  }
                  rows={4}
                  placeholder="e.g. New supplier delivery"
                  className="w-full resize-none rounded-xl border border-[#E5E7EB] px-3 py-3 text-sm outline-none focus:border-[#1E84E7] focus:ring-4 focus:ring-indigo-50"
                />

              </div>

            </div>

            <div className="border-t border-[#E5E7EB] px-5 py-4">

              <div className="flex gap-3">

                <button
                  type="button"
                  onClick={() =>
                    setShowDrawer(false)
                  }
                  disabled={saving}
                  className="h-11 flex-1 rounded-xl border border-[#E5E7EB] text-sm font-semibold hover:bg-[#F9FAFB]"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={submitMovement}
                  disabled={saving}
                  className="h-11 flex-1 rounded-xl bg-[#1E84E7] text-sm font-semibold text-white hover:bg-[#1E66AA] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Updating..."
                    : "Update stock"}
                </button>

              </div>

            </div>

          </aside>

        </div>

      )}

      {/* History drawer */}
      {showHistory && selectedProduct && (

        <div className="fixed inset-0 z-50">

          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            onClick={() =>
              setShowHistory(false)
            }
          />

          <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">

              <div>
                <h2 className="text-lg font-semibold">
                  Stock history
                </h2>

                <p className="text-sm text-[#6B7280]">
                  {selectedProduct.name}
                </p>
              </div>

              <button
                onClick={() =>
                  setShowHistory(false)
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]"
              >
                <X className="h-5 w-5" />
              </button>

            </div>

            <div className="flex-1 overflow-y-auto p-5">

              {error && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              {historyLoading ? (

                <div className="space-y-3">
                  {[1, 2, 3, 4].map((item) => (
                    <div
                      key={item}
                      className="h-20 animate-pulse rounded-xl bg-[#F3F4F6]"
                    />
                  ))}
                </div>

              ) : movements.length === 0 ? (

                <div className="py-16 text-center">

                  <Package className="mx-auto mb-3 h-8 w-8 text-[#9CA3AF]" />

                  <p className="text-sm font-medium">
                    No stock movements yet.
                  </p>

                  <p className="mt-1 text-xs text-[#9CA3AF]">
                    Stock activity will appear here.
                  </p>

                </div>

              ) : (

                <div className="space-y-3">

                  {movements.map((movement) => (

                    <div
                      key={movement.id}
                      className="rounded-xl border border-[#E5E7EB] p-4"
                    >

                      <div className="flex items-start justify-between gap-4">

                        <div className="flex items-center gap-3">

                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                              movement.movement_type ===
                              "stock_in"
                                ? "bg-green-50 text-green-600"
                                : "bg-red-50 text-red-600"
                            }`}
                          >
                            {movement.movement_type ===
                            "stock_in" ? (
                              <ArrowDownToLine className="h-5 w-5" />
                            ) : (
                              <ArrowUpFromLine className="h-5 w-5" />
                            )}
                          </div>

                          <div>

                            <p className="text-sm font-semibold">
                              {getMovementLabel(
                                movement.movement_type
                              )}
                            </p>

                            <p className="mt-0.5 text-xs text-[#9CA3AF]">
                              {formatDate(
                                movement.created_at
                              )}
                            </p>

                          </div>

                        </div>

                        <span className="text-sm font-bold">
                          {movement.movement_type ===
                          "stock_in"
                            ? "+"
                            : "-"}
                          {Number(
                            movement.quantity
                          )}
                        </span>

                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">

                        <div className="rounded-lg bg-[#F8FAFC] p-3">
                          <p className="text-[#9CA3AF]">
                            Previous
                          </p>
                          <p className="mt-1 font-semibold">
                            {Number(
                              movement.previous_quantity
                            )}
                          </p>
                        </div>

                        <div className="rounded-lg bg-[#F8FAFC] p-3">
                          <p className="text-[#9CA3AF]">
                            New stock
                          </p>
                          <p className="mt-1 font-semibold">
                            {Number(
                              movement.new_quantity
                            )}
                          </p>
                        </div>

                      </div>

                      {movement.note && (
                        <p className="mt-3 text-xs text-[#6B7280]">
                          {movement.note}
                        </p>
                      )}

                    </div>

                  ))}

                </div>

              )}

            </div>

          </aside>

        </div>

      )}

    </main>
  );
}