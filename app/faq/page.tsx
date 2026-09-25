import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Accordion } from "@/components/ui/Accordion";
import { pageLayouts } from "@/lib/layout-config";
import { WHATSAPP_URL } from "@/lib/ui-data";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "Find answers to frequently asked questions about IGI diamond certification, ring sizing, insured delivery, payments, and 7-day returns at VAIRIS.",
};

const faqs = [
  {
    id: "q1",
    question: "Are all VAIRIS diamonds natural and certified?",
    answer:
      "Yes. Every diamond piece is accompanied by an authentic certificate from the International Gemological Institute (IGI), detailing carat weight, color, and clarity. Gold is 100% BIS hallmarked solid gold (14K or 18K).",
  },
  {
    id: "q2",
    question: "How do I determine my correct ring size at home?",
    answer:
      "We provide a comprehensive printable and interactive sizing guide. If you are ever unsure, message our concierge team on WhatsApp — we will help you verify your fit over video or send a complimentary physical ring sizer.",
  },
  {
    id: "q3",
    question: "How does insured delivery work?",
    answer:
      "All orders are shipped via secure, specialized luxury couriers (Sequel Logistics & Blue Dart Apex) in tamper-evident packaging. Every shipment is 100% insured from our hands to yours.",
  },
  {
    id: "q4",
    question: "What is your return and exchange policy?",
    answer:
      "We offer a 7-day hassle-free return and exchange policy on eligible pieces. You can initiate a return directly via WhatsApp or your account, and we will arrange a complimentary insured reverse pickup from your doorstep.",
  },
  {
    id: "q5",
    question: "Can I customize a design or order in a different gold purity?",
    answer:
      "Absolutely. Our concierge team specializes in bespoke requests, including custom engravings, alternative metal colors (Rose Gold, Yellow Gold, White Gold), and tailored carat weights.",
  },
  {
    id: "q6",
    question: "What payment methods do you accept?",
    answer:
      "We accept all major UPI apps (Google Pay, PhonePe, Paytm), credit and debit cards, net banking, and direct bank transfers via our secured payment infrastructure.",
  },
];

export default function FaqPage() {
  return (
    <PageShell
      {...pageLayouts.contact}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "FAQ" },
      ]}
    >
      <Container>
        <div style={{ maxWidth: "760px", margin: "0 auto", paddingBlock: "var(--section-gap)" }}>
          <header style={{ textAlign: "center", marginBottom: "3rem" }}>
            <p
              style={{
                fontSize: "0.8125rem",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "var(--color-primary, #c9a96e)",
                marginBottom: "0.75rem",
                fontWeight: 600,
              }}
            >
              Help &amp; Answers
            </p>
            <h1
              style={{
                fontFamily: "var(--font-serif, serif)",
                fontSize: "clamp(2rem, 4vw, 2.75rem)",
                fontWeight: 400,
                color: "var(--color-text)",
                marginBottom: "1rem",
              }}
            >
              Frequently Asked Questions
            </h1>
            <p style={{ color: "var(--color-text-muted)", fontSize: "1rem" }}>
              Everything you need to know about our jewellery, certifications, sizing, and policies.
            </p>
          </header>

          <div style={{ marginBottom: "3.5rem" }}>
            <Accordion items={faqs} />
          </div>

          <div
            style={{
              textAlign: "center",
              padding: "2.5rem",
              borderRadius: "8px",
              background: "var(--color-surface-subtle, #f8f5f0)",
              border: "1px solid var(--color-border-light)",
            }}
          >
            <h2 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>Still have questions?</h2>
            <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", marginBottom: "1.5rem" }}>
              Our personal jewellery specialists are available daily to assist with sizing, styling, and order inquiries.
            </p>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
              <Button href={WHATSAPP_URL} variant="primary">
                Chat on WhatsApp →
              </Button>
              <Button href="/contact" variant="secondary">
                Contact Concierge
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </PageShell>
  );
}
