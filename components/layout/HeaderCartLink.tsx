"use client";

import Link from "next/link";
import { IconCart } from "@/components/icons";
import { useCart } from "@/components/commerce/CartProvider";
import { CHECKOUT_ENABLED } from "@/lib/flags";

export function HeaderCartLink() {
  const { count } = useCart();

  // WhatsApp-enquiry mode (Razorpay not live): no cart entry point at all
  if (!CHECKOUT_ENABLED) return null;

  return (
    <Link href="/cart" className="cart-badge" aria-label={`Cart${count ? `, ${count} ${count === 1 ? "item" : "items"}` : ""}`}>
      <IconCart />
      {count > 0 && <span className="cart-badge__count">{count}</span>}
    </Link>
  );
}
