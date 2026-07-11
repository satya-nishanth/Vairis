"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import { CartModalProvider, useCartModal } from "@/components/commerce/CartModal";
import { CommerceTrustHelpPanel } from "@/components/commerce/CommerceTrustHelpPanel";
import { WishlistButton } from "@/components/commerce/WishlistButton";
import { ProductImage } from "@/components/ui/ProductImage";
import { PdpStickyBar } from "@/components/commerce/PdpStickyBar";
import { useCart } from "@/components/commerce/CartProvider";
import { pageLayouts } from "@/lib/layout-config";
import { compareTrustItems } from "@/lib/compare-trust-content";
import { CATEGORY_LABELS } from "@/lib/catalogue-ui";
import { prismaCategoryToSlug } from "@/lib/categories";
import { CHECKOUT_ENABLED } from "@/lib/flags";
import { calculatePrice } from "@/lib/pricing";

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
  variants: Variant[];
};

type Props = {
  product: ProductData;
  goldRates: { metalType: string; ratePerGram: string }[];
};

function PdpContent({ product, goldRates }: Props) {
  const { openCartModal } = useCartModal();
  const { addItem, isLoggedIn, hydrated } = useCart();
  const router = useRouter();
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [activeThumb, setActiveThumb] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    product.variants[0]?.id ?? null,
  );
  const swipeRef = useRef<HTMLDivElement>(null);

  const gallery = useMemo(
    () =>
      product.images.map((src) => ({
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
  const price = selectedVariant
    ? Math.round(calculatePrice(
        {
          weightGrams: Number(selectedVariant.weightGrams),
          makingChargePerGram: Number(selectedVariant.makingChargePerGram),
          flatMakingCharge: Number(selectedVariant.flatMakingCharge),
          stoneCharges: Number(selectedVariant.stoneCharges),
          miscCharges: Number(selectedVariant.miscCharges),
        },
        rateMap[selectedVariant.metalType] ?? 0,
      ).total)
    : undefined;

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

  const whatsappText = encodeURIComponent(
    `Hi! I'm interested in *${product.name}*${product.itemCode ? ` (Code: ${product.itemCode})` : ""} from VAIRIS.`,
  );

  const handleAddToCart = async () => {
    if (!selectedVariant) return;
    if (hydrated && !isLoggedIn) {
      router.push(`/auth/login?next=/product/${product.id}`);
      return;
    }
    setAddingToCart(true);
    setCartError(null);
    try {
      await addItem(selectedVariant.id, 1);
      openCartModal();
    } catch {
      setCartError("Couldn't add to cart. Please try again.");
    } finally {
      setAddingToCart(false);
    }
  };

  return (
    <PageShell
      {...pageLayouts.pdp}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: categoryLabel, href: `/all-products/${categorySlug}` },
        { label: product.name },
      ]}
    >
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

            {price != null && (
              <p className="pdp-info__price">
                ₹{price.toLocaleString("en-IN")}
                <span className="pdp-info__meta"> incl. GST</span>
              </p>
            )}

            {product.description && (
              <p className="pdp-info__description">{product.description}</p>
            )}

            {product.variants.length > 0 && (
              <div className="pdp-options">
                <label>Metal</label>
                <div className="pdp-variants">
                  {product.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className={`btn ${v.id === selectedVariantId ? "btn-primary" : "btn-secondary"}`}
                      aria-pressed={v.id === selectedVariantId}
                      onClick={() => setSelectedVariantId(v.id)}
                    >
                      {METAL_LABELS[v.metalType] ?? v.metalType}
                      {v.size ? ` — Size ${v.size}` : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {product.comingSoon ? (
              <div className="pdp-info__coming-soon">
                <p className="pdp-info__coming-soon-label">Coming Soon</p>
                <div className="pdp-info__notify">
                  <WishlistButton
                    productId={product.id}
                    productName={product.name}
                  />
                  <span>Notify me when it&apos;s back</span>
                </div>
              </div>
            ) : (
              <div className="pdp-actions pdp-actions--inline">
                {/* Self-serve checkout is behind CHECKOUT_ENABLED until
                    Razorpay is fully live — WhatsApp is the purchase CTA */}
                {CHECKOUT_ENABLED && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleAddToCart}
                    disabled={addingToCart || !selectedVariant}
                  >
                    {addingToCart ? "Adding…" : "Add to Cart"}
                  </button>
                )}
                <a
                  href={`https://wa.me/917075486464?text=${whatsappText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={CHECKOUT_ENABLED ? "btn btn-secondary" : "btn btn-primary"}
                >
                  Enquire on WhatsApp
                </a>
                <WishlistButton
                  productId={product.id}
                  productName={product.name}
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
      </main>

      {!product.comingSoon && (
        <PdpStickyBar
          price={price}
          onAddToCart={handleAddToCart}
          addingToCart={addingToCart}
          expertLabel="Enquire on WhatsApp"
        />
      )}
    </PageShell>
  );
}

export default function ProductPageClient({ product, goldRates }: Props) {
  const { count } = useCart();
  return (
    <CartModalProvider bagCount={count}>
      <PdpContent product={product} goldRates={goldRates} />
    </CartModalProvider>
  );
}
