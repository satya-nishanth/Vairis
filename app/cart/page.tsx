import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { CartItem, FoundersBanner, UpsellCard } from "@/components/commerce/CartItem";
import { OrderSummary, SecureCheckoutButton } from "@/components/commerce/OrderSummary";
import { MobileCheckoutBar } from "@/components/commerce/MobileCheckoutBar";
import { pageLayouts } from "@/lib/layout-config";
import { getCategoryProducts, getProduct, FEATURED_PRODUCT_SLUG } from "@/lib/ui-data";
import { marketingImages } from "@/lib/images";

export default function CartPage() {
  const layout = pageLayouts.cart;
  const featured = getProduct(FEATURED_PRODUCT_SLUG);
  const earring = getCategoryProducts("earrings")[0]!;
  const upsellRing = getCategoryProducts("rings")[0]!;
  const upsellBracelet = getCategoryProducts("bracelets")[0]!;
  const upsellEarring = getCategoryProducts("earrings")[1] ?? getCategoryProducts("earrings")[0]!;
  const upsellEarring2 = getCategoryProducts("earrings")[2] ?? getCategoryProducts("earrings")[0]!;

  if (!featured) {
    return null;
  }

  return (
    <PageShell
      {...layout}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Your Cart" },
      ]}
    >
      <Container>
        <h1 style={{ fontSize: "2rem", marginBottom: 8 }}>Your Cart (2 Items)</h1>
        <p style={{ marginBottom: 32 }}>Insured delivery on every order.</p>

        <div className="cart-layout">
          <div>
            <CartItem
              item={{
                slug: featured.slug,
                name: featured.name,
                image: featured.image,
                meta: `${featured.sku} · Natural Diamonds`,
                tags: ["Everyday Wear", "IGI Certified"],
                price: featured.price ?? 0,
                showOptions: true,
              }}
            />
            <CartItem
              item={{
                slug: earring.slug,
                name: earring.name,
                image: earring.image,
                meta: `${earring.sku} · Natural Diamonds`,
                tags: ["IGI Certified"],
                price: earring.price ?? 0,
              }}
            />

            <h3 style={{ margin: "40px 0 20px", fontSize: "1.125rem" }}>Pairs beautifully with</h3>
            <div className="upsell-row">
              <UpsellCard name={upsellRing.name} image={upsellRing.image} price={upsellRing.price ?? 12499} />
              <UpsellCard name={upsellBracelet.name} image={upsellBracelet.image} price={upsellBracelet.price ?? 19999} />
              <UpsellCard name={upsellEarring.name} image={upsellEarring.image} price={upsellEarring.price ?? 8999} />
              <UpsellCard name={upsellEarring2.name} image={upsellEarring2.image} price={upsellEarring2.price ?? 9499} />
            </div>

            <FoundersBanner
              image={marketingImages.cart.founders}
              quote="We built Vairis to make diamond jewellery wearable daily - without showroom markups."
              subtext="No Showroom Markups · Transparent Pricing · Certified & Authentic"
            />
          </div>

          <OrderSummary
            lines={[
              { label: "Subtotal", value: "-" },
              { label: "Making Charges", value: "Included" },
              { label: "Shipping", value: "FREE" },
              { label: "GST (3%)", value: "Included" },
            ]}
            total={0}
            showEmi
            showPromo
            footer={
              <>
                <details style={{ margin: "16px 0", fontSize: "0.8125rem" }}>
                  <summary>Why are Vairis prices lower?</summary>
                  <p style={{ marginTop: 8 }}>We sell direct without showroom overheads.</p>
                </details>
                <SecureCheckoutButton />
                <p style={{ fontSize: "0.75rem", textAlign: "center", marginTop: 16 }}>IGI · BIS Hallmarked · Insured · Secure</p>
              </>
            }
          />
        </div>
      </Container>
      <MobileCheckoutBar total={26998} href="/checkout" label="Proceed to Checkout" />
    </PageShell>
  );
}
