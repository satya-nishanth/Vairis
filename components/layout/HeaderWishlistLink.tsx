"use client";

import Link from "next/link";
import { ThemeIcon } from "@/components/icons/ThemeIcon";
import { useWishlist } from "@/components/commerce/WishlistProvider";

export function HeaderWishlistLink() {
  const { count } = useWishlist();

  return (
    <Link href="/wishlist" className="wishlist-badge" aria-label={`Wishlist${count ? `, ${count} ${count === 1 ? "item" : "items"}` : ""}`}>
      <ThemeIcon name="wishlist_heart" category="navigation" size={20} />
      {count > 0 && <span className="wishlist-badge__count">{count}</span>}
    </Link>
  );
}
