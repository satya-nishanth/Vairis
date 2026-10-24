"use client";

import { useEffect, useState } from "react";
import { categoryHref } from "@/lib/catalogue-ui";

export type NavCategory = { slug: string; name: string; href: string };
export type NavCollectionLink = { label: string; href: string };

const INITIAL_CATEGORIES: NavCategory[] = ["rings", "earrings", "pendants", "bracelets", "mangalsutra"].map((slug) => ({
  slug,
  name: slug[0]!.toUpperCase() + slug.slice(1),
  href: categoryHref(slug),
}));

let cachedCategories: NavCategory[] | null = null;
let cachedCollections: NavCollectionLink[] | null = null;

/** Admin-pinned categories (header) and collections (nav), shared by the desktop menu and the mobile drawer. */
export function useNavData() {
  const [categories, setCategories] = useState<NavCategory[]>(cachedCategories ?? INITIAL_CATEGORIES);
  const [collections, setCollections] = useState<NavCollectionLink[]>(cachedCollections ?? []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/nav-categories")
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: { slug: string; name: string }[]) => {
        if (cancelled || !Array.isArray(rows) || rows.length === 0) return;
        cachedCategories = rows.map((r) => ({ slug: r.slug, name: r.name, href: categoryHref(r.slug) }));
        setCategories(cachedCategories);
      })
      .catch(() => {});
    fetch("/api/nav-collections", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: { slug: string; title: string }[]) => {
        if (cancelled || !Array.isArray(rows)) return;
        cachedCollections = rows.map((r) => ({ label: r.title, href: `/collections/${r.slug}` }));
        setCollections(cachedCollections);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, collections };
}
