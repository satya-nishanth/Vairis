"use client";

import Link from "next/link";
import { IconCart } from "@/components/icons";
import { useCart } from "@/components/commerce/CartProvider";

export function HeaderCartLink() {
  const { count } = useCart();

  return (
    <Link href="/cart" className="cart-badge" aria-label={`Cart${count ? `, ${count} items` : ""}`}>
      <IconCart />
      {count > 0 && <span className="cart-badge__count">{count}</span>}
    </Link>
  );
}
