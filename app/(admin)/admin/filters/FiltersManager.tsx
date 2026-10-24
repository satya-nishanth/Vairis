"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { CategoryFilterConfig } from "@/lib/category-filters";

type CategoryItem = {
  slug: string;
  name: string;
};

type ProductItem = {
  id: string;
  name: string;
  itemCode: string | null;
  category: string;
  designStyle: string | null;
  description: string | null;
};

const SUGGESTED_LABELS = [
  "Solitaire",
  "Cocktail",
  "Stackable",
  "Halo",
  "Vintage",
  "Bridal",
  "Everyday Wear",
  "Office Wear",
  "Party Wear",
  "Minimal",
  "Floral",
  "Geometric",
  "Gifting",
  "Modern",
  "Traditional",
];

const STANDARD_METALS = [
  "Yellow Gold",
  "White Gold",
  "Rose Gold",
  "18K Gold",
  "14K Gold",
  "Platinum",
];

export function FiltersManager({
  categories,
  initialConfigs,
  products,
}: {
  categories: CategoryItem[];
  initialConfigs: Record<string, CategoryFilterConfig>;
  products: ProductItem[];
}) {
  const [selectedSlug, setSelectedSlug] = useState<string>(
    categories[0]?.slug ?? "rings"
  );
  const [configs, setConfigs] = useState<Record<string, CategoryFilterConfig>>(initialConfigs);
  const [newLabelText, setNewLabelText] = useState("");
  const [activeLabelForProducts, setActiveLabelForProducts] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const activeCategory = useMemo(
    () => categories.find((c) => c.slug === selectedSlug) ?? categories[0],
    [categories, selectedSlug]
  );

  const activeConfig = useMemo(() => {
    const existing = configs[selectedSlug];
    if (existing) return existing;
    return {
      categorySlug: selectedSlug,
      categoryName: activeCategory?.name || selectedSlug,
      labels: ["Solitaire", "Everyday Wear", "Office Wear", "Minimal", "Gifting"],
      metals: ["Yellow Gold", "White Gold", "Rose Gold", "18K Gold"],
      labelProductMap: {},
      updatedAt: new Date().toISOString(),
    };
  }, [configs, selectedSlug, activeCategory]);

  // Products belonging to the selected category
  const categoryProducts = useMemo(() => {
    const slug = selectedSlug.toLowerCase();
    return products.filter((p) => {
      const pCat = (p.category ?? "").toLowerCase();
      return pCat === slug || pCat.replace(/s$/, "") === slug.replace(/s$/, "");
    });
  }, [products, selectedSlug]);

  // Count how many products match each label (auto text match + explicit mapping)
  const labelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const map = activeConfig.labelProductMap || {};

    for (const label of activeConfig.labels) {
      const lower = label.toLowerCase();
      const explicitIds = map[label] || [];

      const matched = categoryProducts.filter((p) => {
        if (explicitIds.includes(p.id) || (p.itemCode && explicitIds.includes(p.itemCode))) {
          return true;
        }
        const text = [
          p.name,
          p.itemCode ?? "",
          p.designStyle ?? "",
          p.description ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return text.includes(lower);
      });

      counts[label] = matched.length;
    }
    return counts;
  }, [activeConfig, categoryProducts]);

  function handleAddLabel(labelToAdd?: string) {
    const val = (labelToAdd ?? newLabelText).trim();
    if (!val) return;

    if (activeConfig.labels.some((l) => l.toLowerCase() === val.toLowerCase())) {
      setStatusMessage({ type: "error", text: `Label "${val}" already exists.` });
      return;
    }

    const nextLabels = [...activeConfig.labels, val];
    updateCurrentConfig({ labels: nextLabels });
    setNewLabelText("");
    setStatusMessage(null);
  }

  function handleRemoveLabel(labelToRemove: string) {
    const nextLabels = activeConfig.labels.filter((l) => l !== labelToRemove);
    const nextMap = { ...(activeConfig.labelProductMap || {}) };
    delete nextMap[labelToRemove];
    updateCurrentConfig({ labels: nextLabels, labelProductMap: nextMap });
    if (activeLabelForProducts === labelToRemove) {
      setActiveLabelForProducts(null);
    }
  }

  function handleMoveLabel(index: number, direction: "up" | "down") {
    const nextLabels = [...activeConfig.labels];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= nextLabels.length) return;

    const temp = nextLabels[index];
    nextLabels[index] = nextLabels[targetIndex];
    nextLabels[targetIndex] = temp;
    updateCurrentConfig({ labels: nextLabels });
  }

  function handleToggleMetal(metal: string) {
    const current = activeConfig.metals || STANDARD_METALS;
    const next = current.includes(metal)
      ? current.filter((m) => m !== metal)
      : [...current, metal];
    updateCurrentConfig({ metals: next });
  }

  function handleToggleProductAssignment(productId: string) {
    if (!activeLabelForProducts) return;
    const currentMap = { ...(activeConfig.labelProductMap || {}) };
    const currentList = currentMap[activeLabelForProducts] || [];

    const nextList = currentList.includes(productId)
      ? currentList.filter((id) => id !== productId)
      : [...currentList, productId];

    currentMap[activeLabelForProducts] = nextList;
    updateCurrentConfig({ labelProductMap: currentMap });
  }

  function updateCurrentConfig(partial: Partial<CategoryFilterConfig>) {
    setConfigs((prev) => ({
      ...prev,
      [selectedSlug]: {
        ...activeConfig,
        ...partial,
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  async function handleSave() {
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/admin/filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: selectedSlug,
          categoryName: activeCategory?.name || selectedSlug,
          labels: activeConfig.labels,
          metals: activeConfig.metals,
          labelProductMap: activeConfig.labelProductMap,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to save filters");
      }

      setStatusMessage({
        type: "success",
        text: `Filter labels saved for ${activeCategory?.name || selectedSlug}!`,
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err?.message || "An error occurred while saving.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm(`Reset filter labels for "${activeCategory?.name}" back to default presets?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/filters?slug=${selectedSlug}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setConfigs((prev) => ({
          ...prev,
          [selectedSlug]: data.data,
        }));
        setStatusMessage({
          type: "success",
          text: `Reset ${activeCategory?.name} filters to defaults.`,
        });
      }
    } catch {
      setStatusMessage({ type: "error", text: "Failed to reset filters." });
    }
  }

  const filteredProductsForAssign = useMemo(() => {
    if (!productSearch.trim()) return categoryProducts;
    const term = productSearch.toLowerCase().trim();
    return categoryProducts.filter((p) => {
      return (
        p.name.toLowerCase().includes(term) ||
        (p.itemCode && p.itemCode.toLowerCase().includes(term)) ||
        (p.designStyle && p.designStyle.toLowerCase().includes(term))
      );
    });
  }, [categoryProducts, productSearch]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "1.5rem", marginTop: "1rem" }}>
      {/* Left Column: Category Selector */}
      <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "1rem" }}>
        <h2 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
          Categories
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {categories.map((cat) => {
            const isSelected = cat.slug === selectedSlug;
            const cfg = configs[cat.slug];
            const labelCount = cfg?.labels?.length ?? 0;

            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() => {
                  setSelectedSlug(cat.slug);
                  setActiveLabelForProducts(null);
                  setStatusMessage(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.625rem 0.75rem",
                  borderRadius: 6,
                  border: isSelected ? "1px solid #111827" : "1px solid transparent",
                  background: isSelected ? "#111827" : "transparent",
                  color: isSelected ? "#ffffff" : "#374151",
                  fontSize: "0.875rem",
                  fontWeight: isSelected ? 600 : 400,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
              >
                <span>{cat.name}</span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "2px 6px",
                    borderRadius: 999,
                    background: isSelected ? "rgba(255,255,255,0.2)" : "#f3f4f6",
                    color: isSelected ? "#ffffff" : "#6b7280",
                  }}
                >
                  {labelCount} labels
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Column: Filter Labels Editor */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {/* Active Category Header Card */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "1.25rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 600, color: "#111827", margin: 0 }}>
                {activeCategory?.name}
              </h2>
              <span
                style={{
                  fontSize: "0.75rem",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontWeight: 500,
                }}
              >
                slug: {selectedSlug}
              </span>
              <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                ({categoryProducts.length} active products)
              </span>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "#6b7280", margin: "4px 0 0" }}>
              Labels defined here are rendered as interactive filters on the customer storefront.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Link
              href={`/all-products/${selectedSlug}`}
              target="_blank"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "6px 12px",
                fontSize: "0.8125rem",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                color: "#374151",
                textDecoration: "none",
                background: "#f9fafb",
              }}
            >
              View in Storefront ↗
            </Link>
          </div>
        </div>

        {/* Feedback message */}
        {statusMessage && (
          <div
            style={{
              padding: "0.75rem 1rem",
              borderRadius: 6,
              fontSize: "0.875rem",
              background: statusMessage.type === "success" ? "#ecfdf5" : "#fef2f2",
              color: statusMessage.type === "success" ? "#065f46" : "#991b1b",
              border: `1px solid ${statusMessage.type === "success" ? "#a7f3d0" : "#fecaca"}`,
            }}
          >
            {statusMessage.text}
          </div>
        )}

        {/* Labels Management Card */}
        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "1.25rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#111827", margin: "0 0 0.5rem" }}>
            Category Style Labels
          </h3>
          <p style={{ fontSize: "0.8125rem", color: "#6b7280", margin: "0 0 1rem" }}>
            Add, reorder, or remove filter labels for this category. Shoppers can click these in the filter sidebar to refine products.
          </p>

          {/* Add Label Bar */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <input
              type="text"
              placeholder='Add a new label (e.g. "Cocktail", "Bridal", "Everyday")...'
              value={newLabelText}
              onChange={(e) => setNewLabelText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddLabel();
                }
              }}
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: "0.875rem",
              }}
            />
            <button
              type="button"
              onClick={() => handleAddLabel()}
              style={{
                padding: "8px 16px",
                background: "#111827",
                color: "#ffffff",
                border: "none",
                borderRadius: 6,
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              + Add Label
            </button>
          </div>

          {/* Quick Suggestions */}
          <div style={{ marginBottom: "1.25rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#6b7280", marginRight: "0.5rem" }}>
              Quick Suggestions:
            </span>
            <div style={{ display: "inline-flex", flexWrap: "wrap", gap: "0.375rem", marginTop: "0.25rem" }}>
              {SUGGESTED_LABELS.filter(
                (s) => !activeConfig.labels.some((l) => l.toLowerCase() === s.toLowerCase())
              ).slice(0, 8).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleAddLabel(suggestion)}
                  style={{
                    padding: "3px 8px",
                    background: "#f3f4f6",
                    border: "1px dashed #d1d5db",
                    borderRadius: 4,
                    fontSize: "0.75rem",
                    color: "#374151",
                    cursor: "pointer",
                  }}
                >
                  + {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Current Active Labels List */}
          <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: "1rem" }}>
            <h4 style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#4b5563", marginBottom: "0.75rem" }}>
              Configured Filter Labels ({activeConfig.labels.length})
            </h4>

            {activeConfig.labels.length === 0 ? (
              <p style={{ fontSize: "0.875rem", color: "#9ca3af", fontStyle: "italic" }}>
                No filter labels configured yet. Add labels above to allow customers to filter this category.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {activeConfig.labels.map((label, index) => {
                  const count = labelCounts[label] ?? 0;
                  const isAssignedSelected = activeLabelForProducts === label;
                  const explicitCount = (activeConfig.labelProductMap?.[label] || []).length;

                  return (
                    <div
                      key={label}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.625rem 0.875rem",
                        background: isAssignedSelected ? "#f0fdf4" : "#f9fafb",
                        border: `1px solid ${isAssignedSelected ? "#86efac" : "#e5e7eb"}`,
                        borderRadius: 6,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <span style={{ fontSize: "0.8125rem", color: "#9ca3af", width: 18 }}>
                          {index + 1}.
                        </span>
                        <strong style={{ fontSize: "0.875rem", color: "#111827" }}>{label}</strong>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            padding: "2px 6px",
                            borderRadius: 4,
                            background: count > 0 ? "#e0e7ff" : "#f3f4f6",
                            color: count > 0 ? "#3730a3" : "#6b7280",
                            fontWeight: 500,
                          }}
                        >
                          {count} matching product{count === 1 ? "" : "s"}
                        </span>
                        {explicitCount > 0 && (
                          <span
                            style={{
                              fontSize: "0.6875rem",
                              padding: "2px 5px",
                              borderRadius: 4,
                              background: "#dcfce7",
                              color: "#166534",
                            }}
                          >
                            {explicitCount} manually assigned
                          </span>
                        )}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveLabelForProducts(isAssignedSelected ? null : label)
                          }
                          style={{
                            padding: "4px 8px",
                            fontSize: "0.75rem",
                            borderRadius: 4,
                            border: "1px solid #d1d5db",
                            background: isAssignedSelected ? "#dcfce7" : "#ffffff",
                            color: isAssignedSelected ? "#15803d" : "#374151",
                            cursor: "pointer",
                          }}
                        >
                          {isAssignedSelected ? "Close Products" : "Assign Products"}
                        </button>

                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMoveLabel(index, "up")}
                          style={{
                            padding: "4px 6px",
                            fontSize: "0.75rem",
                            borderRadius: 4,
                            border: "1px solid #e5e7eb",
                            background: "#ffffff",
                            color: index === 0 ? "#d1d5db" : "#4b5563",
                            cursor: index === 0 ? "default" : "pointer",
                          }}
                          title="Move Up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={index === activeConfig.labels.length - 1}
                          onClick={() => handleMoveLabel(index, "down")}
                          style={{
                            padding: "4px 6px",
                            fontSize: "0.75rem",
                            borderRadius: 4,
                            border: "1px solid #e5e7eb",
                            background: "#ffffff",
                            color: index === activeConfig.labels.length - 1 ? "#d1d5db" : "#4b5563",
                            cursor: index === activeConfig.labels.length - 1 ? "default" : "pointer",
                          }}
                          title="Move Down"
                        >
                          ↓
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveLabel(label)}
                          style={{
                            padding: "4px 8px",
                            fontSize: "0.75rem",
                            borderRadius: 4,
                            border: "1px solid #fecaca",
                            background: "#fee2e2",
                            color: "#b91c1c",
                            cursor: "pointer",
                          }}
                          title="Remove Label"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Product Assignment Drawer/Panel (when a label is opened) */}
          {activeLabelForProducts && (
            <div
              style={{
                marginTop: "1.25rem",
                padding: "1rem",
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <div>
                  <h4 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "#0f172a", margin: 0 }}>
                    Assign Products for label: <span style={{ color: "#2563eb" }}>&quot;{activeLabelForProducts}&quot;</span>
                  </h4>
                  <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "2px 0 0" }}>
                    Select specific products in {activeCategory.name} to tag with this label. Products also auto-match if their name or description mentions &quot;{activeLabelForProducts}&quot;.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveLabelForProducts(null)}
                  style={{
                    padding: "4px 8px",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    fontSize: "0.75rem",
                    cursor: "pointer",
                  }}
                >
                  Done
                </button>
              </div>

              <input
                type="text"
                placeholder="Search products in this category..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  fontSize: "0.8125rem",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  marginBottom: "0.75rem",
                  boxSizing: "border-box",
                }}
              />

              <div
                style={{
                  maxHeight: 260,
                  overflowY: "auto",
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  background: "#ffffff",
                }}
              >
                {filteredProductsForAssign.length === 0 ? (
                  <p style={{ padding: "1rem", textAlign: "center", fontSize: "0.8125rem", color: "#94a3b8" }}>
                    No products found in this category.
                  </p>
                ) : (
                  filteredProductsForAssign.map((p) => {
                    const explicitList = activeConfig.labelProductMap?.[activeLabelForProducts] || [];
                    const isExplicit = explicitList.includes(p.id) || (p.itemCode && explicitList.includes(p.itemCode));
                    const autoMatches = [
                      p.name,
                      p.itemCode ?? "",
                      p.designStyle ?? "",
                      p.description ?? "",
                    ]
                      .join(" ")
                      .toLowerCase()
                      .includes(activeLabelForProducts.toLowerCase());

                    return (
                      <label
                        key={p.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          borderBottom: "1px solid #f1f5f9",
                          fontSize: "0.8125rem",
                          cursor: "pointer",
                          background: isExplicit ? "#f0fdf4" : "transparent",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <input
                            type="checkbox"
                            checked={Boolean(isExplicit)}
                            onChange={() => handleToggleProductAssignment(p.id)}
                          />
                          <span style={{ fontWeight: 500, color: "#1e293b" }}>{p.name}</span>
                          {p.itemCode && (
                            <span style={{ color: "#64748b", fontSize: "0.75rem" }}>
                              ({p.itemCode})
                            </span>
                          )}
                        </div>

                        {autoMatches && (
                          <span
                            style={{
                              fontSize: "0.6875rem",
                              color: "#0369a1",
                              background: "#e0f2fe",
                              padding: "2px 6px",
                              borderRadius: 4,
                            }}
                          >
                            keyword match
                          </span>
                        )}
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Metal Filters Card */}
        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "1.25rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#111827", margin: "0 0 0.5rem" }}>
            Metal Filter Options
          </h3>
          <p style={{ fontSize: "0.8125rem", color: "#6b7280", margin: "0 0 0.75rem" }}>
            Select which metals appear as filter checkboxes under the &quot;Metal&quot; group on this category page.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {STANDARD_METALS.map((metal) => {
              const isChecked = (activeConfig.metals || STANDARD_METALS).includes(metal);
              return (
                <label
                  key={metal}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: `1px solid ${isChecked ? "#111827" : "#d1d5db"}`,
                    background: isChecked ? "#f9fafb" : "#ffffff",
                    fontSize: "0.8125rem",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleMetal(metal)}
                  />
                  <span style={{ fontWeight: isChecked ? 600 : 400, color: "#111827" }}>
                    {metal}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Live Storefront Filter Preview Card */}
        <div style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 8, padding: "1.25rem" }}>
          <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#334155", margin: "0 0 0.5rem" }}>
            Live Preview: Customer Storefront Filter Panel
          </h4>
          <p style={{ fontSize: "0.75rem", color: "#64748b", margin: "0 0 1rem" }}>
            This is how the filter sidebar appears to customers when visiting <code>/all-products/{selectedSlug}</code>:
          </p>

          <div style={{ maxWidth: 300, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 6, padding: "1rem" }}>
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", marginBottom: "0.5rem" }}>
                Style
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {activeConfig.labels.map((label) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8125rem", color: "#334155" }}>
                    <div style={{ width: 14, height: 14, border: "1px solid #cbd5e1", borderRadius: 3 }} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", marginBottom: "0.5rem" }}>
                Metal
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {(activeConfig.metals || STANDARD_METALS).map((metal) => (
                  <div key={metal} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8125rem", color: "#334155" }}>
                    <div style={{ width: 14, height: 14, border: "1px solid #cbd5e1", borderRadius: 3 }} />
                    <span>{metal}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Action Footer */}
        <div
          style={{
            position: "sticky",
            bottom: "1rem",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "1rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)",
          }}
        >
          <button
            type="button"
            onClick={handleReset}
            style={{
              padding: "8px 14px",
              background: "#ffffff",
              border: "1px solid #d1d5db",
              borderRadius: 6,
              fontSize: "0.875rem",
              color: "#6b7280",
              cursor: "pointer",
            }}
          >
            Reset to Defaults
          </button>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              style={{
                padding: "10px 24px",
                background: "#111827",
                color: "#ffffff",
                border: "none",
                borderRadius: 6,
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: isSaving ? "not-allowed" : "pointer",
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? "Saving..." : "Save Filter Labels"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
