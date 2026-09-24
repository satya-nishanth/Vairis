import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Track Your Order",
  description:
    "Track your VAIRIS order status, shipment tracking details, and live delivery updates with your order ID.",
};

export default function TrackOrderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
