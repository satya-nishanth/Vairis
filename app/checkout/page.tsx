import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/ui/Stepper";
import { OrderSummary } from "@/components/commerce/OrderSummary";
import { StaffAvatars } from "@/components/content/TestimonialCard";
import { ProductImage } from "@/components/ui/ProductImage";
import { MobileCheckoutBar } from "@/components/commerce/MobileCheckoutBar";
import { pageLayouts } from "@/lib/layout-config";
import { WHATSAPP_URL, getProduct, FEATURED_PRODUCT_SLUG } from "@/lib/ui-data";
import { marketingImages } from "@/lib/images";

export default function CheckoutPage() {
  const layout = pageLayouts.checkout;
  const featured = getProduct(FEATURED_PRODUCT_SLUG);

  return (
    <PageShell {...layout}>
      <Container>
        <Stepper
          steps={[
            { label: "Cart", state: "done" },
            { label: "Delivery", state: "active", number: "2" },
            { label: "Payment", state: "upcoming", number: "3" },
            { label: "Confirmation", state: "upcoming", number: "4" },
          ]}
        />

        <div className="checkout-layout">
          <div>
            <section className="checkout-section">
              <h2 className="checkout-section__title">
                <span className="checkout-section__num">1</span> Delivery Address
              </h2>
              <div className="form-group">
                <label htmlFor="name">Full Name</label>
                <input className="form-input" id="name" type="text" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="phone">Mobile Number</label>
                  <input className="form-input" id="phone" type="tel" placeholder="+91" />
                </div>
                <div className="form-group">
                  <label htmlFor="pin">Pincode</label>
                  <input className="form-input" id="pin" type="text" />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="address">Address</label>
                <input className="form-input" id="address" type="text" />
              </div>
              <p style={{ fontSize: "0.8125rem" }}>🛡 Your jewellery delivery is fully insured and OTP protected.</p>
            </section>

            <section className="checkout-section">
              <h2 className="checkout-section__title">
                <span className="checkout-section__num">2</span> Shipping Method
              </h2>
              <div className="shipping-card">
                <div>
                  <strong>Express Insured Delivery</strong>
                  <br />
                  <span style={{ fontSize: "0.8125rem" }}>Delivered by Tue, 20 May · Tamper-proof packaging</span>
                </div>
                <strong>FREE</strong>
              </div>
            </section>

            <section className="checkout-section">
              <h2 className="checkout-section__title">
                <span className="checkout-section__num">3</span> Choose Payment Method
              </h2>
              <label className="payment-option is-selected">
                <input type="radio" name="pay" defaultChecked />{" "}
                <div>
                  <strong>UPI / Cards / Netbanking</strong>{" "}
                  <span style={{ fontSize: "0.75rem", background: "var(--bg-category)", padding: "2px 6px" }}>Recommended</span>
                </div>
              </label>
              <label className="payment-option">
                <input type="radio" name="pay" />{" "}
                <div>
                  <strong>EMI Available</strong>
                  <p style={{ fontSize: "0.8125rem" }}>From ₹1,245/month</p>
                </div>
              </label>
            </section>

            <Button href="/order-confirmation" variant="primary" full className="checkout-submit--inline" style={{ marginTop: 8 }}>
              🔒 Proceed to Secure Payment
            </Button>
          </div>

          <OrderSummary
            editCartHref="/cart"
            lines={[
              { label: "Subtotal", value: "₹24,999" },
              { label: "Shipping", value: "FREE" },
              { label: "Taxes (3%)", value: "₹1,999" },
            ]}
            total={26998}
            footer={
              <>
                <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                  {featured && (
                    <>
                      <ProductImage src={featured.image} alt="" width={64} height={64} style={{ borderRadius: 4 }} />
                      <div>
                        <strong style={{ color: "var(--color-text)" }}>{featured.name}</strong>
                        <br />
                        <span style={{ fontSize: "0.8125rem" }}>{featured.sku} · Qty: 1</span>
                      </div>
                    </>
                  )}
                </div>
                <p style={{ fontSize: "0.8125rem", margin: "20px 0" }}>100% Secure Payments · IGI &amp; BIS Certification · Insured Delivery</p>
                <h3 style={{ fontSize: "0.9375rem", marginBottom: 8 }}>Have questions?</h3>
                <StaffAvatars images={marketingImages.staff.avatars} />
                <Button href={WHATSAPP_URL} variant="secondary" full style={{ marginTop: 12 }}>
                  Chat on WhatsApp
                </Button>
              </>
            }
          />
        </div>
      </Container>
      <MobileCheckoutBar
        total={26998}
        href="/order-confirmation"
        label="Place Order"
        totalLabel="Order total"
      />
    </PageShell>
  );
}
