"use client";

import { useEffect, useState } from "react";
import {
  Package,
  Plus,
  Search,
  MoreHorizontal,
  X,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getPlanLimitMessage } from "@/lib/billing/errors";

type Product = {
  id: string;
  name: string;
  item_type: "product" | "service";
  sku: string | null;
  selling_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
};

export default function ProductsPage() {
  const supabase = createClient();

  const [products, setProducts] = useState<Product[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");

  const [name, setName] = useState("");
  const [itemType, setItemType] = useState<"product" | "service">("product");
  const [sku, setSku] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: membership } = await supabase
      .from("business_members")
      .select("business_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      window.location.href = "/onboarding/business";
      return;
    }

    setBusinessId(membership.business_id);

    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, item_type, sku, selling_price, stock_quantity, low_stock_threshold, is_active"
      )
      .eq("business_id", membership.business_id)
      .order("created_at", { ascending: false });

    if (!error) {
      setProducts(data ?? []);
    }

    setLoading(false);
  }

  async function createProduct() {
    setErrorMessage("");

    if (!name.trim()) {
      setErrorMessage("Product or service name is required.");
      return;
    }

    if (!sellingPrice || Number(sellingPrice) < 0) {
      setErrorMessage("Enter a valid selling price.");
      return;
    }

    if (!businessId) {
      setErrorMessage("Business not found.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("products").insert({
      business_id: businessId,
      name: name.trim(),
      item_type: itemType,
      sku: sku.trim() || null,
      selling_price: Number(sellingPrice),
      stock_quantity:
        itemType === "product" ? Number(stockQuantity || 0) : 0,
      low_stock_threshold:
        itemType === "product" ? Number(lowStockThreshold || 0) : 0,
    });

    if (error) {
      setErrorMessage(getPlanLimitMessage(error) ?? error.message);
      setSaving(false);
      return;
    }

    setName("");
    setItemType("product");
    setSku("");
    setSellingPrice("");
    setStockQuantity("");
    setLowStockThreshold("5");

    setShowModal(false);
    setSaving(false);

    await loadProducts();
  }

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white">
              N
            </div>

            <span className="text-lg font-bold tracking-tight text-slate-900">
              NousBiz
            </span>
          </div>

          <Package className="h-5 w-5 text-slate-400" />
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-indigo-600">
              Products & Services
            </p>

            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              Products & Services
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Manage everything your business sells.
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Add product
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products and services..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10"
            />
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {loading ? (
            <div className="flex min-h-60 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                <Package className="h-6 w-6 text-slate-400" />
              </div>

              <h2 className="mt-4 font-semibold text-slate-900">
                No products yet
              </h2>

              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Add your first product or service to start building your
                catalogue.
              </p>

              <button
                onClick={() => setShowModal(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Add product
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Name
                    </th>

                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Type
                    </th>

                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                      SKU
                    </th>

                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Price
                    </th>

                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Stock
                    </th>

                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                    <th className="px-5 py-3" />
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((product) => {
                    const lowStock =
                      product.item_type === "product" &&
                      product.stock_quantity <= product.low_stock_threshold;

                    return (
                      <tr key={product.id} className="hover:bg-slate-50">
                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-slate-900">
                            {product.name}
                          </p>
                        </td>

                        <td className="px-5 py-4 text-sm capitalize text-slate-500">
                          {product.item_type}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-500">
                          {product.sku || "—"}
                        </td>

                        <td className="px-5 py-4 text-sm font-medium text-slate-900">
                          ₦{Number(product.selling_price).toLocaleString()}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-500">
                          {product.item_type === "service"
                            ? "—"
                            : product.stock_quantity}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                              !product.is_active
                                ? "bg-slate-100 text-slate-500"
                                : lowStock
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {!product.is_active
                              ? "Inactive"
                              : lowStock
                                ? "Low stock"
                                : "Active"}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            aria-label={`More options for ${product.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Add product or service
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Add something your business sells.
                </p>
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Name
                </label>

                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Premium Sneakers"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Type
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setItemType("product")}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                      itemType === "product"
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    Product
                  </button>

                  <button
                    type="button"
                    onClick={() => setItemType("service")}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                      itemType === "service"
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    Service
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  SKU{" "}
                  <span className="font-normal text-slate-400">
                    (optional)
                  </span>
                </label>

                <input
                  value={sku}
                  onChange={(event) => setSku(event.target.value)}
                  placeholder="e.g. SNK-001"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Selling price
                </label>

                <input
                  type="number"
                  min="0"
                  value={sellingPrice}
                  onChange={(event) => setSellingPrice(event.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>

              {itemType === "product" && (
                <>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Current stock
                    </label>

                    <input
                      type="number"
                      min="0"
                      value={stockQuantity}
                      onChange={(event) =>
                        setStockQuantity(event.target.value)
                      }
                      placeholder="0"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Low-stock threshold
                    </label>

                    <input
                      type="number"
                      min="0"
                      value={lowStockThreshold}
                      onChange={(event) =>
                        setLowStockThreshold(event.target.value)
                      }
                      placeholder="5"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
                    />
                  </div>
                </>
              )}

              {errorMessage && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {errorMessage}
                </div>
              )}

              <button
                type="button"
                onClick={createProduct}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving....
                  </>
                ) : (
                  "Save product"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}