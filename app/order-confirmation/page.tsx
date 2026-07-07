"use client";

import Link from "next/link";
import { useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { OrderSummary } from "@/components/commerce/OrderSummary";
import { HelpBlock } from "@/components/content/TestimonialCard";
import { ProductImage } from "@/components/ui/ProductImage";
import { pageLayouts } from "@/lib/layout-config";
import { categoryHref } from "@/lib/catalogue-ui";
import { WHATSAPP_URL, getProduct, FEATURED_PRODUCT_SLUG, getCategoryProducts } from "@/lib/ui-data";
import { marketingImages } from "@/lib/images";

function CopyOrderButton({ orderId }: { orderId: string }) {
  const [label, setLabel] = useState("Copy");

  return (
    <button
      type="button"
      data-copy-order-id={orderId}
      style={{ fontSize: "0.75rem", marginLeft: 8 }}
      onClick={() => {
        navigator.clipboard.writeText(orderId).then(() => {
          setLabel("Copied!");
          setTimeout(() => setLabel("Copy"), 2000);
        });
      }}
    >
      {label}
    </button>
  );
}

export default function OrderConfirmationPage() {
  const layout = pageLayouts.confirmation;
  const featured = getProduct(FEATURED_PRODUCT_SLUG);
  const earring = getCategoryProducts("earrings")[0]!;

  return (
    <PageShell {...layout}>
      <Container>
        <div className="confirm-layout">
          <div>
            <div className="confirm-success">
              <div className="confirm-success__icon">✓</div>
              <div>
                <h1 style={{ fontSize: "2rem", marginBottom: 8 }}>Order Confirmed!</h1>
                <p>Thank you! Your order has been successfully placed.</p>
                <p style={{ fontSize: "0.875rem", marginTop: 8 }}>Confirmation sent to you@email.com and WhatsApp.</p>
              </div>
            </div>

            <div className="confirm-card">
              <dl>
                <dt>Order ID</dt>
                <dd>
                  VAR-2026-88421 <CopyOrderButton orderId="VAR-2026-88421" />
                </dd>
                <dt>Payment</dt>
                <dd>Paid Securely 🛡</dd>
                <dt>Order Date</dt>
                <dd>26 May 2026</dd>
                <dt>Estimated Delivery</dt>
                <dd>28 May – 1 Jun 2026</dd>
              </dl>
            </div>

            <section className="what-next">
              {[
                ["📋", "Order Verification", "We confirm your order details."],
                ["🔍", "Quality Check", "Every piece is inspected."],
                ["🚚", "Insured Dispatch", "Tracked, tamper-proof shipping."],
                ["📦", "Delivered", "OTP-protected handover."],
              ].map(([icon, title, desc]) => (
                <div key={title}>
                  <div className="what-next__icon">{icon}</div>
                  <h4>{title}</h4>
                  <p>{desc}</p>
                </div>
              ))}
            </section>

            <div className="tracking-split">
              <div>
                <h3 style={{ marginBottom: 16 }}>Tracking Information</h3>
                <ProductImage src={marketingImages.confirmation.tracking} alt="Tracking app mockup" width={200} height={333} style={{ maxWidth: 200, marginTop: 16 }} />
              </div>
              <div>
                <h3 style={{ marginBottom: 16 }}>Certification You Can Trust</h3>
                <div className="cert-cards">
                  <div className="card">
                    <ProductImage src={marketingImages.confirmation.igi} alt="IGI" width={200} height={250} />
                    <strong>IGI Certified</strong>
                  </div>
                  <div className="card">
                    <ProductImage src={marketingImages.confirmation.bis} alt="BIS" width={200} height={200} />
                    <strong>BIS Hallmarked</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="founders-thanks">
              <ProductImage src={marketingImages.confirmation.founders} alt="Founders" width={280} height={187} />
              <div>
                <p style={{ fontFamily: "var(--font-serif)", fontSize: "1.25rem", color: "var(--color-text)" }}>
                  Thank you for trusting Vairis with your everyday diamonds.
                </p>
                <p style={{ marginTop: 12 }}>- Team Vairis</p>
              </div>
            </div>

            <h3 style={{ margin: "32px 0 16px" }}>Need Help?</h3>
            <div className="help-cards">
              <HelpBlock variant="tile" title="Chat on WhatsApp" href={WHATSAPP_URL} />
              <HelpBlock variant="tile" title="Call Us" href="tel:+917070607070" />
              <HelpBlock variant="tile" title="Email Us" href="mailto:hello@vairis.com" />
              <HelpBlock variant="tile" title="FAQs" href="/contact" />
            </div>

            <h3 style={{ margin: "48px 0 16px" }}>While You Wait</h3>
            <div className="teaser-row">
              {[
                [marketingImages.confirmation.teasers.ring, "Everyday Essentials", categoryHref("necklaces")],
                [marketingImages.confirmation.teasers.guide, "First Diamond Guide", "/contact"],
                [marketingImages.confirmation.teasers.care, "Care Tips", "#"],
                [marketingImages.confirmation.teasers.realWomen, "Real Women, Real Stories", "#"],
              ].map(([src, title, href]) => (
                <Link key={title as string} href={href as string} className="teaser-card">
                  <ProductImage src={src as string} alt="" width={400} height={300} />
                  <h4>{title as string}</h4>
                </Link>
              ))}
            </div>
          </div>

          <OrderSummary
            lines={[
              { label: "Subtotal", value: "₹56,046" },
              { label: "Shipping", value: "FREE" },
              { label: "GST", value: "Included" },
            ]}
            total={56046}
            footer={
              <>
                <div style={{ display: "flex", gap: 12, margin: "16px 0" }}>
                  {featured && (
                    <>
                      <ProductImage src={featured.image} alt="" width={48} height={48} />
                      <div>
                        <strong style={{ color: "var(--color-text)", fontSize: "0.875rem" }}>{featured.name}</strong>
                        <br />Qty 1
                      </div>
                    </>
                  )}
                </div>
                <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                  <ProductImage src={earring.image} alt="" width={48} height={48} />
                  <div>
                    <strong style={{ color: "var(--color-text)", fontSize: "0.875rem" }}>{earring.name}</strong>
                    <br />Qty 1
                  </div>
                </div>
                <p style={{ fontSize: "0.8125rem", margin: "16px 0" }}>Payment: UPI (Paid)</p>
                <Button href="/" variant="primary" full>
                  Track Order
                </Button>
                <Button variant="secondary" full style={{ marginTop: 12 }}>
                  Download Invoice
                </Button>
              </>
            }
          />
        </div>
      </Container>
    </PageShell>
  );
}
