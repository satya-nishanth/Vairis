import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { pageLayouts } from "@/lib/layout-config";
import { WHATSAPP_URL } from "@/lib/ui-data";

export const metadata: Metadata = {
  title: "About Us — Our Story & Craftsmanship",
  description:
    "Learn about VAIRIS — minimal fine diamond jewellery designed for modern life. IGI certified diamonds, BIS hallmarked gold, and direct-to-consumer transparent pricing.",
};

export default function AboutPage() {
  return (
    <PageShell
      {...pageLayouts.contact}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "About Us" },
      ]}
    >
      <Container>
        <div style={{ maxWidth: "800px", margin: "0 auto", paddingBlock: "var(--section-gap)" }}>
          <header style={{ textAlign: "center", marginBottom: "3.5rem" }}>
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
              Our Story &amp; Philosophy
            </p>
            <h1
              style={{
                fontFamily: "var(--font-serif, serif)",
                fontSize: "clamp(2rem, 4vw, 3rem)",
                fontWeight: 400,
                color: "var(--color-text)",
                lineHeight: 1.2,
                marginBottom: "1rem",
              }}
            >
              Crafted for the Everyday
            </h1>
            <p
              style={{
                fontSize: "1.125rem",
                color: "var(--color-text-muted)",
                lineHeight: 1.6,
                maxWidth: "600px",
                margin: "0 auto",
              }}
            >
              Born from a simple belief: fine diamond jewellery shouldn&apos;t live in bank lockers. It belongs in your everyday rhythm.
            </p>
          </header>

          <section style={{ marginBottom: "3.5rem", lineHeight: 1.8, color: "var(--color-text)" }}>
            <h2
              style={{
                fontFamily: "var(--font-serif, serif)",
                fontSize: "1.75rem",
                fontWeight: 400,
                marginBottom: "1rem",
              }}
            >
              The VAIRIS Vision
            </h2>
            <p style={{ marginBottom: "1.25rem", color: "var(--color-text-muted)" }}>
              For generations, buying fine diamond jewellery has meant navigating crowded showrooms, high retail markups, and opaque pricing breakdowns. The result was pieces too heavy, too expensive, or too fragile to wear outside of weddings and formal gatherings.
            </p>
            <p style={{ marginBottom: "1.25rem", color: "var(--color-text-muted)" }}>
              VAIRIS was founded to rewrite that script. We design lightweight, comfortable, and timeless pieces made from BIS hallmarked gold and IGI certified natural diamonds — crafted specifically for morning meetings, coffee runs, weekend brunches, and spontaneous evenings out.
            </p>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1.5rem",
              marginBottom: "3.5rem",
            }}
          >
            <div
              style={{
                background: "var(--color-surface-subtle, #f8f5f0)",
                border: "1px solid var(--color-border-light)",
                borderRadius: "8px",
                padding: "1.75rem",
              }}
            >
              <h3 style={{ fontSize: "1.125rem", marginBottom: "0.5rem" }}>IGI Certified</h3>
              <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", lineHeight: 1.6 }}>
                Every single diamond is independently certified by International Gemological Institute (IGI). Zero guesswork, complete peace of mind.
              </p>
            </div>

            <div
              style={{
                background: "var(--color-surface-subtle, #f8f5f0)",
                border: "1px solid var(--color-border-light)",
                borderRadius: "8px",
                padding: "1.75rem",
              }}
            >
              <h3 style={{ fontSize: "1.125rem", marginBottom: "0.5rem" }}>BIS Hallmarked Gold</h3>
              <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", lineHeight: 1.6 }}>
                Guaranteed gold purity in 14K and 18K solid gold, stamped with official Bureau of Indian Standards (BIS) hallmark seals.
              </p>
            </div>

            <div
              style={{
                background: "var(--color-surface-subtle, #f8f5f0)",
                border: "1px solid var(--color-border-light)",
                borderRadius: "8px",
                padding: "1.75rem",
              }}
            >
              <h3 style={{ fontSize: "1.125rem", marginBottom: "0.5rem" }}>Transparent Pricing</h3>
              <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)", lineHeight: 1.6 }}>
                We believe in complete transparency: true gold weight, live market rates, diamond grades, and zero hidden retail fees.
              </p>
            </div>
          </section>

          <section
            style={{
              textAlign: "center",
              padding: "2.5rem",
              borderRadius: "8px",
              background: "var(--color-surface-subtle, #f8f5f0)",
              border: "1px solid var(--color-border-light)",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-serif, serif)",
                fontSize: "1.75rem",
                fontWeight: 400,
                marginBottom: "0.75rem",
              }}
            >
              Experience Everyday Luxury
            </h2>
            <p
              style={{
                fontSize: "0.9375rem",
                color: "var(--color-text-muted)",
                marginBottom: "1.75rem",
                maxWidth: "480px",
                marginInline: "auto",
              }}
            >
              Browse our curated collection of everyday pieces or speak with our concierge team for custom sizing and bespoke guidance.
            </p>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
              <Button href="/all-products/rings" variant="primary">
                Explore Collections →
              </Button>
              <Button href={WHATSAPP_URL} variant="secondary">
                Chat with Concierge
              </Button>
            </div>
          </section>
        </div>
      </Container>
    </PageShell>
  );
}
