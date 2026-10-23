import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your fine jewellery order with secure checkout and insured delivery.",
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
