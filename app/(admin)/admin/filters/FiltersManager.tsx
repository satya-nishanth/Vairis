"use client";

import { useMemo, useState } from "react";
import type { CategoryFilterConfig } from "@/lib/category-filters";

type CategoryItem = { slug: string; name: string };
type ProductItem = { id: string; name: string; itemCode: string | null; category: string };
type Group = "types" | "occasions";

const GROUPS: { id: Group; title: string; hint: string; suggestions: string[] }[] = [
  {
    id: "types",
    title: "Type",
    hint: "What the piece is, e.g. Solitaire, Band. The first three also show as quick chips on mobile.",
    suggestions: ["Solitaire", "Stackable", "Band", "Halo", "Cocktail", "Bridal", "Floral", "Minimal"],
  },
  {
    id: "occasions",
    title: "Occasion",
    hint: "When it is worn, e.g. Everyday, Office, Gifting.",
    suggestions: ["Everyday", "Office", "Gifting", "Party", "Wedding"],
  },
];

const card = { background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "1.25rem" } as const;
const btn = {
  padding: "0.4rem 0.75rem",
  borderRadius: 6,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  fontSize: "0.8125rem",
  cursor: "pointer",
} as const;

export function FiltersManager({
  categories,
  initialConfigs,
  products,
}: {
  categories: CategoryItem[];
  initialConfigs: Record<string, CategoryFilterConfig>;
  products: ProductItem[];
}) {
  const [selectedSlug, setSelectedSlug] = useState(categories[0]?.slug ?? "rings");
  const [configs, setConfigs] = useState(initialConfigs);
  const [newLabel, setNewLabel] = useState<Record<Group, string>>({ types: "", occasions: "" });
  const [assignLabel, setAssignLabel] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const category = categories.find((c) => c.slug === selectedSlug);
  const config: CategoryFilterConfig = configs[selectedSlug] ?? {
    categorySlug: selectedSlug,
    categoryName: category?.name ?? selectedSlug,
    types: [],
    occasions: [],
    labels: [],
    labelProductMap: {},
    updatedAt: "",
  };
  const categoryProducts = useMemo(
    () => products.filter((p) => p.category === selectedSlug),
    [products, selectedSlug],
  );
  const canAssign = categoryProducts.length > 0;

  function update(partial: Partial<CategoryFilterConfig>) {
    const next = { ...config, ...partial };
    next.labels = [...next.types, ...next.occasions];
    setConfigs((prev) => ({ ...prev, [selectedSlug]: next }));
  }

  function addLabel(group: Group, raw: string) {
    const label = raw.trim();
    if (!label || config.labels.includes(label)) return;
    update({ [group]: [...config[group], label] });
    setNewLabel((prev) => ({ ...prev, [group]: "" }));
  }

  function removeLabel(group: Group, label: string) {
    const map = { ...config.labelProductMap };
    delete map[label];
    update({ [group]: config[group].filter((l) => l !== label), labelProductMap: map });
    if (assignLabel === label) setAssignLabel(null);
  }

  function moveLabel(group: Group, index: number, dir: -1 | 1) {
    const list = [...config[group]];
    const to = index + dir;
    if (to < 0 || to >= list.length) return;
    [list[index], list[to]] = [list[to], list[index]];
    update({ [group]: list });
  }

  function toggleProduct(label: string, productId: string) {
    const current = config.labelProductMap[label] ?? [];
    const next = current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId];
    update({ labelProductMap: { ...config.labelProductMap, [label]: next } });
  }

  async function call(init: RequestInit, url = "/api/admin/filters") {
    const res = await fetch(url, init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || "Request failed");
    return data.data as CategoryFilterConfig;
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const saved = await call({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: selectedSlug,
          categoryName: category?.name,
          types: config.types,
          occasions: config.occasions,
          labelProductMap: canAssign ? config.labelProductMap : undefined,
        }),
      });
      setConfigs((prev) => ({ ...prev, [selectedSlug]: { ...config, ...saved, labelProductMap: config.labelProductMap } }));
      setStatus({ ok: true, text: `Saved filters for ${category?.name ?? selectedSlug}.` });
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : "Could not save." });
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!confirm(`Reset the option lists for "${category?.name}" to the defaults? Product tags are kept.`)) return;
    try {
      const reset = await call({ method: "DELETE" }, `/api/admin/filters?slug=${selectedSlug}`);
      setConfigs((prev) => ({
        ...prev,
        [selectedSlug]: { ...reset, labelProductMap: prev[selectedSlug]?.labelProductMap ?? {} },
      }));
      setStatus({ ok: true, text: `Reset ${category?.name} to defaults.` });
    } catch {
      setStatus({ ok: false, text: "Could not reset." });
    }
  }

  const visibleProducts = categoryProducts.filter((p) => {
    const term = search.toLowerCase().trim();
    return !term || p.name.toLowerCase().includes(term) || (p.itemCode ?? "").toLowerCase().includes(term);
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: "1.5rem", marginTop: "1rem" }}>
      <div style={{ ...card, padding: "1rem", alignSelf: "start" }}>
        <h2 style={{ fontSize: "0.875rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", margin: "0 0 0.75rem" }}>
          Categories
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {categories.map((cat) => {
            const on = cat.slug === selectedSlug;
            return (
              <button
                key={cat.slug}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setSelectedSlug(cat.slug);
                  setAssignLabel(null);
                  setStatus(null);
                }}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.6rem 0.75rem",
                  borderRadius: 6,
                  border: "1px solid transparent",
                  background: on ? "#111827" : "transparent",
                  color: on ? "#ffffff" : "#374151",
                  fontSize: "0.875rem",
                  cursor: "pointer",
                }}
              >
                <span>{cat.name}</span>
                <span style={{ opacity: 0.7 }}>{configs[cat.slug]?.labels?.length ?? 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.125rem" }}>{category?.name ?? selectedSlug}</h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.8125rem", color: "#6b7280" }}>
              Shown in the Filter sheet on /all-products/{selectedSlug}. Options with no products are hidden for shoppers.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={btn} onClick={reset}>Reset to defaults</button>
            <button type="button" style={{ ...btn, background: "#111827", color: "#fff" }} onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
        {status && (
          <div role="status" style={{ ...card, padding: "0.75rem 1rem", color: status.ok ? "#166534" : "#991b1b" }}>
            {status.text}
          </div>
        )}

        {GROUPS.map((g) => (
          <div key={g.id} style={card}>
            <h3 style={{ margin: 0, fontSize: "1rem" }}>{g.title}</h3>
            <p style={{ margin: "4px 0 12px", fontSize: "0.8125rem", color: "#6b7280" }}>{g.hint}</p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {config[g.id].map((label, i) => {
                const count = (config.labelProductMap[label] ?? []).length;
                return (
                  <li key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ flex: 1, fontSize: "0.875rem" }}>{label}</span>
                    {canAssign && (
                      <button type="button" style={btn} onClick={() => { setAssignLabel(assignLabel === label ? null : label); setSearch(""); }}>
                        {count} product{count === 1 ? "" : "s"}
                      </button>
                    )}
                    <button type="button" style={btn} aria-label={`Move ${label} up`} onClick={() => moveLabel(g.id, i, -1)} disabled={i === 0}>↑</button>
                    <button type="button" style={btn} aria-label={`Move ${label} down`} onClick={() => moveLabel(g.id, i, 1)} disabled={i === config[g.id].length - 1}>↓</button>
                    <button type="button" style={btn} aria-label={`Remove ${label}`} onClick={() => removeLabel(g.id, label)}>Remove</button>
                  </li>
                );
              })}
              {config[g.id].length === 0 && <li style={{ fontSize: "0.8125rem", color: "#6b7280" }}>No {g.title.toLowerCase()} options yet.</li>}
            </ul>
            <form
              onSubmit={(e) => { e.preventDefault(); addLabel(g.id, newLabel[g.id]); }}
              style={{ display: "flex", gap: 8, marginTop: 12 }}
            >
              <input
                value={newLabel[g.id]}
                onChange={(e) => setNewLabel((prev) => ({ ...prev, [g.id]: e.target.value }))}
                placeholder={`Add a ${g.title.toLowerCase()}`}
                aria-label={`New ${g.title.toLowerCase()} option`}
                style={{ flex: 1, padding: "0.4rem 0.6rem", border: "1px solid #d1d5db", borderRadius: 6 }}
              />
              <button type="submit" style={btn}>Add</button>
            </form>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {g.suggestions.filter((s) => !config.labels.includes(s)).map((s) => (
                <button key={s} type="button" style={{ ...btn, padding: "0.2rem 0.5rem", color: "#6b7280" }} onClick={() => addLabel(g.id, s)}>
                  + {s}
                </button>
              ))}
            </div>
          </div>
        ))}

        {assignLabel && (
          <div style={card}>
            <h3 style={{ margin: 0, fontSize: "1rem" }}>Products tagged &ldquo;{assignLabel}&rdquo;</h3>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products"
              aria-label="Search products"
              style={{ margin: "12px 0", width: "100%", padding: "0.4rem 0.6rem", border: "1px solid #d1d5db", borderRadius: 6 }}
            />
            <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 360, overflowY: "auto" }}>
              {visibleProducts.map((p) => (
                <li key={p.id}>
                  <label style={{ display: "flex", gap: 8, padding: "4px 0", fontSize: "0.875rem" }}>
                    <input
                      type="checkbox"
                      checked={(config.labelProductMap[assignLabel] ?? []).includes(p.id)}
                      onChange={() => toggleProduct(assignLabel, p.id)}
                    />
                    {p.name}
                    {p.itemCode && <span style={{ color: "#6b7280" }}>{p.itemCode}</span>}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
