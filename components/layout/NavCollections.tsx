"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type NavCollection = { slug: string; title: string };

let cache: NavCollection[] | null = null;

/** Admin-pinned collections in the header nav (Collections → "Show in nav"). */
export function NavCollections() {
  const [items, setItems] = useState<NavCollection[]>(cache ?? []);

  useEffect(() => {
    if (cache) return;
    fetch("/api/nav-collections")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: NavCollection[]) => {
        cache = rows;
        setItems(rows);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      {items.map((c) => (
        <Link key={c.slug} href={`/collections/${c.slug}`}>
          {c.title}
        </Link>
      ))}
    </>
  );
}
