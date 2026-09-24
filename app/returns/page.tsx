import { PageShell } from "@/components/layout/PageShell";
import { TrustBar } from "@/components/layout/TrustBar";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Accordion } from "@/components/ui/Accordion";
import { ProductImage } from "@/components/ui/ProductImage";
import { pageLayouts } from "@/lib/layout-config";
import { WHATSAPP_URL } from "@/lib/ui-data";
import { marketingImages } from "@/lib/images";

export default function ReturnsPage() {
  const layout = pageLayouts.returns;

  return (
    <PageShell
      {...layout}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Returns & Exchanges" },
      ]}
    >
      <Container>
        <section className="returns-hero">
          <div>
            <h1>Returns made simple &amp; secure</h1>
            <p>Easy exchanges, insured reverse pickup, and transparent refunds - because buying jewellery online should feel safe.</p>
            <div className="returns-chips">
              {["7-Day Easy Returns", "Insured Reverse Pickup", "Tamper-Proof Verification", "Instant Refund Updates", "WhatsApp Support"].map(
                (chip) => (
                  <span key={chip} className="returns-chip">
                    {chip}
                  </span>
                ),
              )}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <Button href={WHATSAPP_URL} variant="primary">
                Start a Return
              </Button>
              <Button href="/track-order" variant="secondary">
                Track Existing Return
              </Button>
            </div>
          </div>
          <div className="returns-hero__visual">
            <ProductImage src={marketingImages.returns.heroOpen} alt="Jewellery return box" width={800} height={800} />
          </div>
        </section>

        <section>
          <h2 style={{ textAlign: "center", marginBottom: 8 }}>How returns work</h2>
          <div className="returns-steps">
            {[
              ["Request Return", "Start via WhatsApp or your order page within 7 days of delivery."],
              ["Secure Reverse Pickup", "We arrange insured pickup at your convenience."],
              ["Quality Check", "Tamper-proof verification at our facility (24–48 hours)."],
              ["Refund Processed", "Amount reflected in 5–7 business days to original payment method."],
            ].map(([title, desc], i) => (
              <article key={title} className="returns-step-card">
                <div className="returns-step-card__num">{i + 1}</div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="protection-split">
          <ProductImage src={marketingImages.returns.sealed} alt="Sealed packaging" width={900} height={675} style={{ width: "100%", borderRadius: 8 }} />
          <div className="protection-grid">
            {[
              ["Insured Shipping", "Full value coverage in transit both ways."],
              ["Tamper-Proof Packaging", "Sealed boxes verified on receipt."],
              ["OTP-Based Delivery", "Secure handover every time."],
              ["Verified Logistics", "Trusted partners only."],
            ].map(([title, desc]) => (
              <div key={title}>
                <h4>{title}</h4>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="eligibility-split">
          <article className="eligibility-card">
            <h3>What products are eligible?</h3>
            <ul>
              <li className="ok">Unworn items in original packaging</li>
              <li className="ok">Within 7 days of delivery</li>
              <li className="ok">With certification &amp; tags intact</li>
              <li className="no">Customised or engraved pieces</li>
              <li className="no">Items showing wear or damage</li>
            </ul>
          </article>
          <article className="eligibility-card">
            <h3>Prefer an exchange instead?</h3>
            <Button href={WHATSAPP_URL} variant="primary" size="sm">
              Talk to Jewellery Concierge
            </Button>
          </article>
        </div>

        <section style={{ marginTop: 48 }}>
          <h2 style={{ textAlign: "center", marginBottom: 32 }}>Frequently asked questions</h2>
          <Accordion
            className="faq-two-col"
            items={[
              { id: "1", question: "How do I start a return?", answer: "Message us on WhatsApp with your order ID or use the link in your confirmation email." },
              { id: "2", question: "Is reverse shipping free?", answer: "Yes, for eligible returns we provide insured reverse pickup at no extra cost." },
              { id: "3", question: "When will I get my refund?", answer: "After quality verification, refunds are processed within 5–7 business days." },
              { id: "4", question: "Can I exchange for a different size?", answer: "Yes - exchanges are often faster than refunds. Contact our concierge team." },
            ]}
          />
          <p style={{ textAlign: "center", marginTop: 24 }}>
            <Button href="/contact" variant="secondary">
              View all FAQs
            </Button>
          </p>
        </section>

        <section className="returns-cta-band">
          <ProductImage src={marketingImages.returns.footerRings} alt="Rings" width={900} height={600} />
          <div>
            <h2>Designed for confident online jewellery shopping</h2>
            <p style={{ margin: "16px 0 24px" }}>Certified diamonds, insured delivery, and humans on the other end of every chat.</p>
            <Button href="/contact" variant="primary">
              Contact Support
            </Button>
            <Button href={WHATSAPP_URL} variant="secondary" style={{ marginLeft: 8 }}>
              Chat on WhatsApp
            </Button>
          </div>
        </section>

        <TrustBar variant="compact" style={{ margin: "48px 0" }} />
      </Container>
    </PageShell>
  );
}
