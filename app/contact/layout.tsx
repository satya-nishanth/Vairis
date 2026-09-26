import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact & Concierge",
  description:
    "Get in touch with VAIRIS. Reach our concierge team via WhatsApp, phone, or message for sizing, custom designs, or order inquiries.",
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
