"use client";

import { useState } from "react";
import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Accordion } from "@/components/ui/Accordion";
import { StaffAvatars, HelpBlock } from "@/components/content/TestimonialCard";
import { ProductImage } from "@/components/ui/ProductImage";
import { pageLayouts } from "@/lib/layout-config";
import { WHATSAPP_URL, FEATURED_PRODUCT_SLUG } from "@/lib/ui-data";
import { marketingImages } from "@/lib/images";

const faqPanels = {
  buying: [
    { id: "b1", question: "Are all diamonds IGI certified?", answer: "Yes. Every Vairis diamond comes with IGI certification and BIS hallmarked gold." },
    { id: "b2", question: "Why are Vairis prices lower than showrooms?", answer: "We sell direct without retail showroom overheads, passing savings to you." },
  ],
  sizing: [
    { id: "s1", question: "How do I measure ring size at home?", answer: "We send a free sizing guide and offer video consultations." },
  ],
  returns: [
    {
      id: "r1",
      question: "What is the return window?",
      answer: (
        <>
          7-day easy returns on eligible items. See our <Link href="/returns">Returns page</Link>.
        </>
      ),
    },
  ],
  wear: [
    { id: "w1", question: "Can I wear these daily?", answer: "Absolutely - our designs are lightweight and made for everyday wear." },
  ],
};

export default function ContactPage() {
  const layout = pageLayouts.contact;
  const [activeTab, setActiveTab] = useState<keyof typeof faqPanels>("buying");

  return (
    <PageShell
      {...layout}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Contact Us" },
      ]}
    >
      <Container>
        <section className="contact-hero">
          <div>
            <h1>Luxury jewellery buying, with real human guidance.</h1>
            <p>Sizing, styling, certifications - our experts help you choose with confidence. Mon–Sat, 10 AM–8 PM.</p>
            <div className="contact-hero__ctas">
              <Button href={WHATSAPP_URL} variant="primary">
                Chat on WhatsApp
              </Button>
              <Button href="/contact" variant="secondary">
                Book a Call
              </Button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20 }}>
              <StaffAvatars images={marketingImages.staff.avatars} />
              <span style={{ fontSize: "0.8125rem" }}>Real experts. Real conversations.</span>
            </div>
          </div>
          <ProductImage src={marketingImages.contact.hero} alt="Concierge support" width={1200} height={800} style={{ borderRadius: 8, width: "100%" }} />
        </section>

        <div className="help-cards-grid">
          <HelpBlock title="WhatsApp Concierge" description="Instant answers from our jewellery experts." href={WHATSAPP_URL} cta="Chat Now →" />
          <HelpBlock title="Book a Consultation" description="Video call styling & sizing session." href="#" cta="Schedule Now →" />
          <HelpBlock title="Ring Sizing Help" description="Find your perfect fit at home." href="#" cta="Find Your Size →" />
          <HelpBlock title="Email Support" description="hello@vairis.com - we reply within 24h." href="mailto:hello@vairis.com" cta="Email Us →" />
        </div>

        <div className="contact-split">
          <div>
            <h2 style={{ marginBottom: 24 }}>Common Questions We Help With</h2>
            <ul className="questions-list">
              {[
                "Is every diamond IGI certified?",
                "How do I choose my first diamond piece?",
                "What's the best chain length for everyday wear?",
                "How does insured delivery work?",
                "What is your return policy?",
                "Do you offer gifting and packaging?",
              ].map((q) => (
                <li key={q}>
                  <span>💎</span> {q}
                </li>
              ))}
            </ul>
            <Button href="#faq" variant="ghost">
              Explore all answers in our FAQ →
            </Button>
          </div>
          <div className="promise-box">
            <h3>A Personal Promise</h3>
            <p>No pressure. No showroom tactics. Just thoughtful guidance.</p>
            <ul>
              <li>Honest recommendations</li>
              <li>Transparent pricing explained</li>
              <li>Certification walkthroughs</li>
              <li>Lifetime support after purchase</li>
            </ul>
            <ProductImage src={marketingImages.contact.team} alt="Concierge team" width={800} height={600} style={{ width: "100%", borderRadius: 8, marginTop: 16 }} />
          </div>
        </div>

        <section className="styling-section">
          <ProductImage src={marketingImages.contact.styling} alt="Styling" width={400} height={600} style={{ width: "100%", borderRadius: 8 }} />
          <div className="styling-steps">
            {["Chat", "Shortlist", "Try virtually", "Order"].map((step, i) => (
              <span key={step} style={{ display: "contents" }}>
                {i > 0 && <span>→</span>}
                <div className="styling-step">
                  <strong>{i + 1}</strong>
                  <br />
                  {step}
                </div>
              </span>
            ))}
          </div>
          <div>
            <h3>Styling Consultation, Made Personal</h3>
            <Button href="#" variant="primary">
              Start Consultation →
            </Button>
          </div>
        </section>

        <section className="faq-section" id="faq">
          <div>
            <div className="faq-tabs">
              {(Object.keys(faqPanels) as (keyof typeof faqPanels)[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={activeTab === tab ? "faq-tab is-active" : "faq-tab"}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === "buying" && "Buying Confidence"}
                  {tab === "sizing" && "Sizing & Fit"}
                  {tab === "returns" && "Returns & Delivery"}
                  {tab === "wear" && "Everyday Wear"}
                </button>
              ))}
            </div>
            <Accordion items={faqPanels[activeTab]} defaultOpenId={faqPanels[activeTab][0]?.id} />
          </div>
          <div className="cert-box">
            <p style={{ fontSize: "2rem" }}>💎</p>
            <h3>100% Certified Jewellery</h3>
            <p style={{ fontSize: "0.875rem", margin: "12px 0" }}>IGI diamonds and BIS hallmarked gold on every piece.</p>
            <Button href={`/product/${FEATURED_PRODUCT_SLUG}`} variant="ghost">
              Learn more →
            </Button>
          </div>
        </section>

        <section className="contact-cta-bottom">
          <h2>Still unsure? Talk to a real human.</h2>
          <p style={{ margin: "12px 0 24px" }}>No pressure. No showroom sales tactics. Just thoughtful guidance.</p>
          <Button href={WHATSAPP_URL} variant="primary">
            Chat on WhatsApp
          </Button>
          <Button href="#" variant="secondary">
            Book a Call
          </Button>
        </section>
      </Container>
    </PageShell>
  );
}
