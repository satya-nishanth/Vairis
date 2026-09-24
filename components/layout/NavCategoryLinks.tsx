"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { categoryHref } from "@/lib/catalogue-ui";

type NavCat = { slug: string; name: string };

const INITIAL_NAV: NavCat[] = [
  { slug: "rings", name: "Rings" },
  { slug: "earrings", name: "Earrings" },
  { slug: "pendants", name: "Pendants" },
  { slug: "bracelets", name: "Bracelets" },
  { slug: "mangalsutra", name: "Mangalsutra" },
];

let cachedNav: NavCat[] | null = null;

export function NavCategoryLinks() {
  const [categories, setCategories] = useState<NavCat[]>(cachedNav ?? INITIAL_NAV);

  useEffect(() => {
    fetch("/api/nav-categories")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: NavCat[]) => {
        if (Array.isArray(data) && data.length > 0) {
          cachedNav = data;
          setCategories(data);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <>
      {categories.map((cat) => (
        <Link key={cat.slug} href={categoryHref(cat.slug)}>
          {cat.name}
        </Link>
      ))}
    </>
  );
}
