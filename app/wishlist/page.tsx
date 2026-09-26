import type { Metadata } from "next";
import { WishlistPageView } from "@/components/commerce/WishlistPageView";

export const metadata: Metadata = {
  title: "Your Wishlist",
  description:
    "View and manage your saved fine jewellery pieces at VAIRIS. Insured delivery across India.",
};

export default function WishlistPage() {
  return <WishlistPageView />;
}
