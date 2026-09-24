import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Shopping Bag",
  description: "Review your selected fine jewellery pieces and proceed to secure checkout at VAIRIS.",
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
