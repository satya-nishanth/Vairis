"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StoreCategoryRecord } from "@/lib/store-categories";

type ProductOption = { id: string; label: string };

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const inputStyle = {
  padding: "8px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  fontSize: "0.875rem",
  width: "100%",
  boxSizing: "border-box" as const,
};

type FormState = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  showInHeader: boolean;
  sortOrder: number;
  productIds: string[];
};

const EMPTY_FORM: FormState = {
  name: "",
  slug: "",
  description: "",
  image: "",
  showInHeader: true,
  sortOrder: 10,
  productIds: [],
};

export function CategoriesManager({
  categories: initialCategories,
  allProducts,
}: {
  categories: StoreCategoryRecord[];
  allProducts: ProductOption[];
}) {
  const router = useRouter();
  const [categories, setCategories] = useState<StoreCategoryRecord[]>(initialCategories);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      sortOrder: (categories[categories.length - 1]?.sortOrder ?? 0) + 1,
    });
    setProductSearch("");
    setShowProductPicker(false);
    setError(null);
    setShowModal(true);
  }

  function openEdit(cat: StoreCategoryRecord) {
    setEditingId(cat.id);
    setForm({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? "",
      image: cat.image ?? "",
      showInHeader: cat.showInHeader,
      sortOrder: cat.sortOrder,
      productIds: cat.productIds ?? [],
    });
    setProductSearch("");
    setShowProductPicker(false);
    setError(null);
    setShowModal(true);
  }

  async function handleToggleHeader(cat: StoreCategoryRecord) {
    const nextVal = !cat.showInHeader;
    // Optimistic UI update
    setCategories((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, showInHeader: nextVal } : c)),
    );

    try {
      const res = await fetch(`/api/admin/categories/${encodeURIComponent(cat.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showInHeader: nextVal }),
      });
      if (!res.ok) {
        // Revert on failure
        setCategories((prev) =>
          prev.map((c) => (c.id === cat.id ? { ...c, showInHeader: !nextVal } : c)),
        );
      } else {
        router.refresh();
      }
    } catch {
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, showInHeader: !nextVal } : c)),
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const payload = {
      name: form.name.trim(),
      slug: slugify(form.slug || form.name),
      description: form.description.trim() || null,
      image: form.image.trim() || null,
      showInHeader: form.showInHeader,
      sortOrder: Number(form.sortOrder) || 10,
      productIds: form.productIds,
    };

    try {
      if (editingId) {
        const res = await fetch(`/api/admin/categories/${encodeURIComponent(editingId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update category");
        setCategories((prev) => prev.map((c) => (c.id === editingId ? data : c)));
      } else {
        const res = await fetch("/api/admin/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create category");
        setCategories((prev) => [...prev, data].sort((a, b) => a.sortOrder - b.sortOrder));
      }
      setShowModal(false);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Operation failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(cat: StoreCategoryRecord) {
    if (!confirm(`Are you sure you want to delete category "${cat.name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/categories/${encodeURIComponent(cat.id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCategories((prev) => prev.filter((c) => c.id !== cat.id));
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to delete category.");
      }
    } catch {
      alert("Network error deleting category.");
    }
  }

  function displayProductCount(cat: StoreCategoryRecord): number {
    const assigned = new Set(cat.productIds ?? []);
    for (const p of allProducts) {
      if (!p.category) continue;
      const match =
        p.category.toLowerCase() === cat.slug.toLowerCase() ||
        p.category.toUpperCase() === cat.slug.toUpperCase();
      if (match) assigned.add(p.id);
    }
    return assigned.size;
  }

  const filteredProducts = allProducts.filter(
    (p) =>
      !form.productIds.includes(p.id) &&
      p.label.toLowerCase().includes(productSearch.toLowerCase()),
  );

  return (
    <div style={{ marginTop: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#111827", margin: 0 }}>
            All Categories ({categories.length})
          </h2>
          <p style={{ fontSize: "0.8125rem", color: "#6b7280", margin: "2px 0 0 0" }}>
            Toggle the switch to instantly show or hide any category on the storefront header.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="btn btn-primary"
          style={{ padding: "8px 16px", fontSize: "0.875rem", cursor: "pointer" }}
        >
          + New Category
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", color: "#4b5563" }}>
              <th style={{ padding: "12px 16px", width: 60 }}>Order</th>
              <th style={{ padding: "12px 16px" }}>Category Name</th>
              <th style={{ padding: "12px 16px", textAlign: "center" }}>Products</th>
              <th style={{ padding: "12px 16px" }}>Storefront URL</th>
              <th style={{ padding: "12px 16px", textAlign: "center" }}>Display in Header</th>
              <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={{ padding: "14px 16px", color: "#9ca3af", fontWeight: 500 }}>
                  {cat.sortOrder}
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ fontWeight: 600, color: "#111827" }}>{cat.name}</div>
                  {cat.description && (
                    <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: 2, maxWidth: 320 }}>
                      {cat.description}
                    </div>
                  )}
                </td>
                <td style={{ padding: "14px 16px", textAlign: "center" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: 12,
                      background: displayProductCount(cat) > 0 ? "#e0f2fe" : "#f3f4f6",
                      color: displayProductCount(cat) > 0 ? "#0369a1" : "#9ca3af",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    {displayProductCount(cat)}
                  </span>
                </td>
                <td style={{ padding: "14px 16px" }}>
                  <a
                    href={`/all-products/${cat.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "var(--color-primary, #b78a3c)", textDecoration: "none", fontSize: "0.8125rem" }}
                  >
                    /all-products/{cat.slug} ↗
                  </a>
                </td>
                <td style={{ padding: "14px 16px", textAlign: "center" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={cat.showInHeader}
                      onChange={() => handleToggleHeader(cat)}
                      style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#b78a3c" }}
                    />
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: cat.showInHeader ? "#047857" : "#9ca3af",
                      }}
                    >
                      {cat.showInHeader ? "ON" : "OFF"}
                    </span>
                  </label>
                </td>
                <td style={{ padding: "14px 16px", textAlign: "right" }}>
                  <div style={{ display: "inline-flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => openEdit(cat)}
                      style={{
                        padding: "4px 10px",
                        fontSize: "0.75rem",
                        borderRadius: 4,
                        border: "1px solid #d1d5db",
                        background: "#fff",
                        color: "#374151",
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(cat)}
                      style={{
                        padding: "4px 10px",
                        fontSize: "0.75rem",
                        borderRadius: 4,
                        border: "1px solid #fecaca",
                        background: "#fef2f2",
                        color: "#dc2626",
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Dialog */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              maxWidth: 580,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600, color: "#111827" }}>
                {editingId ? "Edit Category" : "Create New Category"}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.25rem", cursor: "pointer", color: "#6b7280" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              {error && (
                <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, color: "#b91c1c", fontSize: "0.875rem" }}>
                  {error}
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: 4, color: "#374151" }}>
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  style={inputStyle}
                  placeholder="e.g. Mangalsutra, Bangles, Nose Pins"
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({
                      ...f,
                      name,
                      slug: f.id ? f.slug : slugify(name),
                    }));
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: 4, color: "#374151" }}>
                    URL Slug *
                  </label>
                  <input
                    type="text"
                    required
                    style={inputStyle}
                    placeholder="e.g. bangles"
                    value={form.slug}
                    onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                  />
                  <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                    /all-products/{form.slug || "slug"}
                  </span>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: 4, color: "#374151" }}>
                    Sort Order
                  </label>
                  <input
                    type="number"
                    style={inputStyle}
                    value={form.sortOrder}
                    onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: 4, color: "#374151" }}>
                  Tagline / Description
                </label>
                <textarea
                  rows={2}
                  style={inputStyle}
                  placeholder="Short editorial summary for category listing page"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div style={{ padding: "12px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={form.showInHeader}
                    onChange={(e) => setForm((f) => ({ ...f, showInHeader: e.target.checked }))}
                    style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#b78a3c" }}
                  />
                  <div>
                    <strong style={{ fontSize: "0.875rem", color: "#1e293b", display: "block" }}>
                      Display on website header
                    </strong>
                    <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      When checked, this category link will be shown in the top navigation bar and mobile menu.
                    </span>
                  </div>
                </label>
              </div>

              {/* Product Association */}
              <div>
                <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, marginBottom: 6, color: "#374151" }}>
                  Assigned Products ({form.productIds.length})
                </label>
                {form.productIds.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, maxHeight: 130, overflowY: "auto", padding: "4px 0" }}>
                    {form.productIds.map((pId) => {
                      const prod = allProducts.find((p) => p.id === pId);
                      return (
                        <span
                          key={pId}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 10px",
                            background: "#eef2ff",
                            border: "1px solid #c7d2fe",
                            borderRadius: 14,
                            fontSize: "0.75rem",
                            color: "#3730a3",
                            fontWeight: 500,
                          }}
                        >
                          <span>{prod ? prod.label : pId}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setForm((f) => ({ ...f, productIds: f.productIds.filter((id) => id !== pId) }))
                            }
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#6366f1", padding: 0, fontWeight: 700 }}
                            title="Remove product"
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: "0.8125rem", color: "#6b7280", fontStyle: "italic", marginBottom: 10, padding: "8px 12px", background: "#f9fafb", borderRadius: 6, border: "1px dashed #d1d5db" }}>
                    No products currently assigned to this category. Use search or the browse button below to add products.
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="text"
                    placeholder="Search products to add (title, code, etc.)…"
                    style={inputStyle}
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={() => setShowProductPicker((p) => !p)}
                    style={{ fontSize: "0.75rem", color: "#4f46e5", background: "none", border: "none", cursor: "pointer", padding: "2px 0", fontWeight: 500 }}
                  >
                    {showProductPicker ? "▲ Hide product list" : `▼ Browse available products (${filteredProducts.length})`}
                  </button>
                  {form.productIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, productIds: [] }))}
                      style={{ fontSize: "0.75rem", color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}
                    >
                      Clear all assigned
                    </button>
                  )}
                </div>
                {(productSearch || showProductPicker) && (
                  <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 6, marginTop: 6, background: "#fff" }}>
                    {filteredProducts.slice(0, 25).map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setForm((f) => ({ ...f, productIds: [...f.productIds, p.id] }));
                        }}
                        style={{ padding: "8px 12px", fontSize: "0.8125rem", cursor: "pointer", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                      >
                        <span style={{ color: "#111827" }}>{p.label}</span>
                        <span style={{ fontSize: "0.75rem", color: "#059669", fontWeight: 600 }}>+ Add</span>
                      </div>
                    ))}
                    {filteredProducts.length === 0 && (
                      <div style={{ padding: "10px 12px", fontSize: "0.75rem", color: "#9ca3af" }}>
                        No unassigned products matching "{productSearch}".
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer", fontSize: "0.875rem" }}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: "8px 18px", fontSize: "0.875rem", cursor: "pointer" }}
                  disabled={busy}
                >
                  {busy ? "Saving…" : editingId ? "Update Category" : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
