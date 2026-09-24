"use client";

import { useMemo, useRef, useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import { CartModalProvider, useCartModal } from "@/components/commerce/CartModal";
import { CommerceTrustHelpPanel } from "@/components/commerce/CommerceTrustHelpPanel";
import { ProductReviews } from "@/components/commerce/ProductReviews";
import { ProductCard } from "@/components/commerce/ProductCard";
import { WishlistButton } from "@/components/commerce/WishlistButton";
import { ProductImage } from "@/components/ui/ProductImage";
import { ThemeIcon } from "@/components/icons/ThemeIcon";
import { PdpStickyBar } from "@/components/commerce/PdpStickyBar";
import { QuoteEnquiryModal } from "@/components/commerce/QuoteEnquiryModal";
import { useCart } from "@/components/commerce/CartProvider";
import { pageLayouts } from "@/lib/layout-config";
import { compareTrustItems } from "@/lib/compare-trust-content";
import { CATEGORY_LABELS } from "@/lib/catalogue-ui";
import { prismaCategoryToSlug } from "@/lib/categories";
import { CHECKOUT_ENABLED } from "@/lib/flags";
import { calculatePrice, type PricingConfig, type StoneInput } from "@/lib/pricing";
import type { StoneView } from "@/lib/pricing-data";
import type { Product } from "@/lib/ui-data";
import { track } from "@/lib/analytics-client";

const METAL_LABELS: Record<string, string> = {
  GOLD_18K: "18kt Yellow Gold",
  GOLD_14K: "14kt Yellow Gold",
  ROSE_GOLD: "Rose Gold 18kt",
};

type Variant = {
  id: string;
  metalType: string;
  weightGrams: string;
  makingChargePerGram: string;
  flatMakingCharge: string;
  stoneCharges: string;
  miscCharges: string;
  sku: string | null;
  size: string | null;
};

type ProductData = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  images: string[];
  itemCode: string | null;
  comingSoon: boolean;
  showPrice: boolean;
  stones: StoneView[];
  variants: Variant[];
};

type Props = {
  product: ProductData;
  goldRates: { metalType: string; ratePerGram: string }[];
  pricingConfig: PricingConfig;
  relatedProducts?: Product[];
};

function PdpContent({ product, goldRates, pricingConfig, relatedProducts }: Props) {
  const { openCartModal } = useCartModal();
  const { addItem, isLoggedIn, hydrated } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [activeThumb, setActiveThumb] = useState(0);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    product.variants[0]?.id ?? null,
  );
  const swipeRef = useRef<HTMLDivElement>(null);

  const gallery = useMemo(
    () =>
      product.images
        .filter((src): src is string => Boolean(src))
        .map((src) => ({
          src,
          isVideo: /\.(mp4|webm|mov)(\?|$)/i.test(src),
        })),
    [product.images],
  );
  const categorySlug = prismaCategoryToSlug(product.category);
  const categoryLabel =
    CATEGORY_LABELS[categorySlug as keyof typeof CATEGORY_LABELS]?.title ??
    product.category;

  const rateMap = useMemo(
    () =>
      Object.fromEntries(
        goldRates.map((r) => [r.metalType, Number(r.ratePerGram)]),
      ),
    [goldRates],
  );

  const selectedVariant = product.variants.find(
    (v) => v.id === selectedVariantId,
  );

  const [withExchange, setWithExchange] = useState(false);
  const hasStones = product.stones.length > 0;

  const stoneInputs: StoneInput[] = useMemo(
    () =>
      product.stones.map((s) => ({
        caratWeight: s.caratWeight,
        ratePerCarat: s.ratePerCarat,
        ratePerCaratExchange: s.ratePerCaratExchange,
        typeLabel: s.typeLabel,
      })),
    [product.stones],
  );

  const priceFor = (exchange: boolean) =>
    selectedVariant && Number(selectedVariant.weightGrams) > 0
      ? calculatePrice(
          {
            weightGrams: Number(selectedVariant.weightGrams),
            makingChargePerGram: Number(selectedVariant.makingChargePerGram),
            flatMakingCharge: Number(selectedVariant.flatMakingCharge),
            stoneCharges: Number(selectedVariant.stoneCharges),
            miscCharges: Number(selectedVariant.miscCharges),
          },
          rateMap[selectedVariant.metalType] ?? 0,
          { stones: stoneInputs, withExchange: exchange, config: pricingConfig },
        )
      : undefined;

  const breakdown = priceFor(withExchange);
  const price = breakdown ? Math.round(breakdown.total) : undefined;
  const priceWithout = priceFor(false);
  const priceWith = priceFor(true);

  // Metal + size selection: metals are unique; sizes belong to the chosen
  // metal. Plain derivations — the React Compiler memoizes them.
  const metals = [...new Set(product.variants.map((v) => v.metalType))];
  const selectedMetal = selectedVariant?.metalType ?? metals[0];
  const sizesForMetal = product.variants.filter(
    (v) => v.metalType === selectedMetal && v.size,
  );

  const selectMetal = (metal: string) => {
    // Keep the current size when the new metal has it; else first variant of metal.
    const sameSize = product.variants.find(
      (v) => v.metalType === metal && v.size === selectedVariant?.size,
    );
    const fallback = product.variants.find((v) => v.metalType === metal);
    setSelectedVariantId((sameSize ?? fallback)?.id ?? null);
  };

  useEffect(() => {
    track("pdp_view", { productId: product.id, meta: { name: product.name } });
  }, [product.id, product.name]);

  useEffect(() => {
    const el = swipeRef.current;
    if (!el) return;
    const onScroll = () => {
      const slideWidth = el.clientWidth;
      if (slideWidth <= 0) return;
      setActiveThumb(Math.round(el.scrollLeft / slideWidth));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToSlide = (index: number) => {
    setActiveThumb(index);
    const el = swipeRef.current;
    if (el) el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  };

  // No self-serve checkout without a price to charge — WhatsApp enquiry
  // remains the only CTA for price-hidden products, same as CHECKOUT_ENABLED=false.
  const canAddToCart = CHECKOUT_ENABLED && product.showPrice;

  // Deterministic on server and client (unlike window.location.href, which
  // differs between SSR and the browser and causes a hydration mismatch —
  // the href would silently stick to the server-rendered value).
  const productUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/product/${product.id}`;

  const handleAddToCart = async () => {
    if (!selectedVariant) return;
    if (hydrated && !isLoggedIn) {
      router.push(`/auth/login?next=/product/${product.id}`);
      return;
    }
    setAddingToCart(true);
    setCartError(null);
    try {
      await addItem(selectedVariant.id, 1, withExchange);
      track("add_to_cart", {
        productId: product.id,
        meta: { variantId: selectedVariant.id, withExchange, price },
      });
      openCartModal();
    } catch {
      setCartError("Couldn't add to cart. Please try again.");
    } finally {
      setAddingToCart(false);
    }
  };

  const collectionSlug = searchParams?.get("collection");
  const collectionTitle = collectionSlug
    ? collectionSlug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  const breadcrumbs =
    collectionTitle && collectionSlug
      ? [
          { label: "Home", href: "/" },
          { label: "Collections", href: "/all-products/rings" },
          { label: collectionTitle, href: `/collections/${collectionSlug}` },
          { label: product.name },
        ]
      : [
          { label: "Home", href: "/" },
          { label: categoryLabel, href: `/all-products/${categorySlug}` },
          { label: product.name },
        ];

  return (
    <PageShell {...pageLayouts.pdp} breadcrumbs={breadcrumbs}>
      <main className="container page-main pdp-page">
        <div className="pdp-layout">
          <div className="pdp-gallery__thumbs">
            {gallery.map((media, i) => (
              <button
                key={`${media.src}-${i}`}
                type="button"
                className={[activeThumb === i ? "is-active" : "", media.isVideo ? "pdp-thumb--video" : ""].filter(Boolean).join(" ")}
                onClick={() => scrollToSlide(i)}
                aria-label={media.isVideo ? "Play video" : `Image ${i + 1}`}
              >
                {media.isVideo ? (
                  <video src={media.src} muted playsInline preload="metadata" style={{ width: 72, height: 72, objectFit: "cover" }} />
                ) : (
                  <ProductImage src={media.src} alt="" width={72} height={72} />
                )}
              </button>
            ))}
          </div>

          <div className="pdp-gallery__main">
            <div
              className="pdp-gallery__swipe"
              ref={swipeRef}
              aria-label="Product images"
            >
              {gallery.map((media, i) => (
                <div key={`${media.src}-${i}`} className="pdp-gallery__slide">
                  {media.isVideo ? (
                    <video src={media.src} muted loop playsInline autoPlay controls style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <ProductImage
                      src={media.src}
                      alt={i === 0 ? product.name : ""}
                      width={1200}
                      height={1200}
                      priority={i === 0}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="pdp-gallery__desktop-only">
              {gallery[activeThumb]?.isVideo ? (
                <video
                  key={gallery[activeThumb].src}
                  src={gallery[activeThumb].src}
                  muted
                  loop
                  playsInline
                  autoPlay
                  controls
                  style={{ width: "100%", height: "auto" }}
                />
              ) : (
                <ProductImage
                  src={gallery[activeThumb]?.src ?? ""}
                  alt={product.name}
                  width={1200}
                  height={1200}
                  priority
                />
              )}
            </div>
            {gallery.length > 1 && (
              <div
                className="pdp-gallery__dots"
                role="tablist"
                aria-label="Gallery pagination"
              >
                {gallery.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={activeThumb === i}
                    className={activeThumb === i ? "is-active" : ""}
                    onClick={() => scrollToSlide(i)}
                    aria-label={`Image ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="pdp-info">
            {product.itemCode && (
              <p className="pdp-info__meta">{product.itemCode}</p>
            )}
            <h1 className="pdp-info__title">{product.name}</h1>
            <p className="pdp-info__tagline">{categoryLabel}</p>

            {product.showPrice && price != null ? (
              <p className="pdp-info__price">
                ₹{price.toLocaleString("en-IN")}
                <span className="pdp-info__meta"> incl. GST</span>
              </p>
            ) : (
              !product.showPrice && <p className="pdp-info__price pdp-info__price--on-request">Price on Request</p>
            )}

            {product.description && (
              <p className="pdp-info__description">{product.description}</p>
            )}

            {hasStones && (
              <div className="pdp-options" data-testid="pdp-stones">
                <label>Diamonds</label>
                <ul className="pdp-info__stones">
                  {product.stones.map((s) => (
                    <li key={s.id} className="pdp-info__stone">
                      <span className="pdp-info__stone-label">
                        <ThemeIcon
                          name="vairis_diamond_mark"
                          category="brand"
                          size={16}
                          className="pdp-info__stone-icon"
                        />
                        {s.label ? `${s.label} — ` : ""}
                        {s.typeLabel}
                        {s.count ? ` × ${s.count}` : ""}
                      </span>
                      <span className="pdp-info__stone-carat">{s.caratWeight.toFixed(2)} ct</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {metals.length > 1 && (
              <div className="pdp-options">
                <label>Metal</label>
                <div className="pdp-variants">
                  {metals.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`btn ${m === selectedMetal ? "btn-primary" : "btn-secondary"}`}
                      aria-pressed={m === selectedMetal}
                      onClick={() => selectMetal(m)}
                    >
                      {METAL_LABELS[m] ?? m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sizesForMetal.length > 0 && (
              <div className="pdp-options" data-testid="pdp-sizes">
                <label>Size</label>
                <div className="pdp-variants">
                  {sizesForMetal.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className={`btn ${v.id === selectedVariantId ? "btn-primary" : "btn-secondary"}`}
                      aria-pressed={v.id === selectedVariantId}
                      onClick={() => setSelectedVariantId(v.id)}
                    >
                      {v.size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {product.showPrice && hasStones && priceWith && priceWithout && (
              <div className="pdp-options" data-testid="pdp-exchange">
                <label>Diamond Pricing</label>
                <div className="pdp-variants">
                  <button
                    type="button"
                    className={`btn ${!withExchange ? "btn-primary" : "btn-secondary"}`}
                    aria-pressed={!withExchange}
                    onClick={() => setWithExchange(false)}
                  >
                    Without Exchange — ₹{Math.round(priceWithout.total).toLocaleString("en-IN")}
                  </button>
                  <button
                    type="button"
                    className={`btn ${withExchange ? "btn-primary" : "btn-secondary"}`}
                    aria-pressed={withExchange}
                    onClick={() => setWithExchange(true)}
                  >
                    With Exchange — ₹{Math.round(priceWith.total).toLocaleString("en-IN")}
                  </button>
                </div>
                <p className="pdp-info__meta">
                  With Exchange: your diamonds are priced at the higher exchange
                  rate per carat and qualify for full-value exchange later.
                </p>
              </div>
            )}

            {product.showPrice && breakdown && (
              <details className="pdp-info__breakup" data-testid="pdp-breakup">
                <summary>Price Breakup</summary>
                <table>
                  <tbody>
                    <tr>
                      <td>Gold value ({Number(selectedVariant?.weightGrams).toFixed(3)} g)</td>
                      <td>₹{Math.round(breakdown.goldValue).toLocaleString("en-IN")}</td>
                    </tr>
                    {breakdown.stoneLines.map((l, i) => (
                      <tr key={i}>
                        <td>
                          {l.typeLabel} ({l.caratWeight.toFixed(2)} ct × ₹
                          {l.ratePerCarat.toLocaleString("en-IN")}/ct)
                        </td>
                        <td>₹{Math.round(l.value).toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                    <tr>
                      <td>Making charges</td>
                      <td>₹{Math.round(breakdown.making).toLocaleString("en-IN")}</td>
                    </tr>
                    {breakdown.goldVA > 0 && (
                      <tr>
                        <td>{breakdown.vaLabel}</td>
                        <td>₹{Math.round(breakdown.goldVA).toLocaleString("en-IN")}</td>
                      </tr>
                    )}
                    {breakdown.miscCharges > 0 && (
                      <tr>
                        <td>Hallmarking &amp; certification</td>
                        <td>₹{Math.round(breakdown.miscCharges).toLocaleString("en-IN")}</td>
                      </tr>
                    )}
                    <tr>
                      <td>GST</td>
                      <td>₹{Math.round(breakdown.gst).toLocaleString("en-IN")}</td>
                    </tr>
                    <tr className="pdp-info__breakup-total">
                      <td>Total</td>
                      <td>₹{Math.round(breakdown.total).toLocaleString("en-IN")}</td>
                    </tr>
                  </tbody>
                </table>
              </details>
            )}

            {product.comingSoon ? (
              <div className="pdp-info__coming-soon">
                <p className="pdp-info__coming-soon-label">Coming Soon</p>
                <div className="pdp-info__notify">
                  <WishlistButton
                    productId={product.id}
                    productName={product.name}
                    variant="inline"
                  />
                  <span>Notify me when it&apos;s back</span>
                </div>
              </div>
            ) : (
              <div className="pdp-actions pdp-actions--inline">
                {/* Self-serve checkout is behind CHECKOUT_ENABLED until
                    Razorpay is fully live, and needs a real price — WhatsApp
                    is the purchase CTA in both cases */}
                {canAddToCart && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleAddToCart}
                    disabled={addingToCart || !selectedVariant}
                  >
                    {addingToCart ? "Adding…" : "Add to Cart"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setQuoteModalOpen(true)}
                  className={canAddToCart ? "btn btn-secondary" : "btn btn-primary"}
                >
                  Enquire on WhatsApp
                </button>
                <WishlistButton
                  productId={product.id}
                  productName={product.name}
                  variant="inline"
                />
              </div>
            )}
            {cartError && (
              <p role="alert" className="pdp-info__error">
                {cartError}
              </p>
            )}

            <ul className="pdp-info__trust" aria-label="Product guarantees">
              {compareTrustItems.map(({ label }) => (
                <li key={label} className="pdp-info__trust-label">
                  {label}
                </li>
              ))}
            </ul>

            <div className="pdp-section pdp-section--trust-help">
              <CommerceTrustHelpPanel className="plp-bottom--flush" />
            </div>
          </div>
        </div>

        {relatedProducts && relatedProducts.length > 0 && (
          <section className="pdp-related" style={{ marginTop: "3.5rem", marginBottom: "3rem" }}>
            <h2
              style={{
                fontFamily: "var(--font-serif, serif)",
                fontSize: "1.75rem",
                fontWeight: 400,
                textAlign: "center",
                marginBottom: "2rem",
                color: "var(--color-text)",
              }}
            >
              You May Also Like
            </h2>
            <div className="plp-grid">
              {relatedProducts.map((p, i) => (
                <ProductCard key={p.slug} product={p} showActions={i < 2} />
              ))}
            </div>
          </section>
        )}

        <ProductReviews productId={product.id} productName={product.name} />
      </main>

      {!product.comingSoon && (
        <PdpStickyBar
          price={product.showPrice ? price : undefined}
          onAddToCart={handleAddToCart}
          addingToCart={addingToCart}
          expertLabel="Enquire on WhatsApp"
          onExpertClick={() => setQuoteModalOpen(true)}
          canPurchase={product.showPrice}
        />
      )}
      <QuoteEnquiryModal
        open={quoteModalOpen}
        onClose={() => setQuoteModalOpen(false)}
        isLoggedIn={isLoggedIn}
        productName={product.name}
        productUrl={productUrl}
        itemCode={product.itemCode}
      />
    </PageShell>
  );
}

export default function ProductPageClient(props: Props) {
  const { count } = useCart();
  return (
    <CartModalProvider bagCount={count}>
      <Suspense fallback={null}>
        <PdpContent {...props} />
      </Suspense>
    </CartModalProvider>
  );
}
