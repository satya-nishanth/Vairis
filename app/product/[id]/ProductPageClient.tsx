"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { CartModalProvider, useCartModal } from "@/components/commerce/CartModal";
import { CommerceTrustHelpPanel } from "@/components/commerce/CommerceTrustHelpPanel";
import { WishlistButton } from "@/components/commerce/WishlistButton";
import { ProductImage } from "@/components/ui/ProductImage";
import { PdpStickyBar } from "@/components/commerce/PdpStickyBar";
import { pageLayouts } from "@/lib/layout-config";
import { compareTrustItems } from "@/lib/compare-trust-content";
import { CATEGORY_LABELS } from "@/lib/catalogue-ui";
import { calculatePrice } from "@/lib/pricing";

const PRISMA_TO_CATEGORY: Record<string, string> = {
  RINGS: "rings",
  EARRINGS: "earrings",
  PENDANTS: "pendants",
  BRACELETS: "bracelets",
  NECKLACES: "necklaces",
};

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
  const [activeThumb, setActiveThumb] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    product.variants[0]?.id ?? null,
  );
  const swipeRef = useRef<HTMLDivElement>(null);

  const gallery = product.images.length > 0 ? product.images : [];
  const categorySlug = PRISMA_TO_CATEGORY[product.category] ?? "rings";
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
    ? calculatePrice(
        {
          weightGrams: Number(selectedVariant.weightGrams),
          makingChargePerGram: Number(selectedVariant.makingChargePerGram),
          flatMakingCharge: Number(selectedVariant.flatMakingCharge),
          stoneCharges: Number(selectedVariant.stoneCharges),
          miscCharges: Number(selectedVariant.miscCharges),
        },
        rateMap[selectedVariant.metalType] ?? 0,
      ).total
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
            {gallery.map((src, i) => (
              <button
                key={`${src}-${i}`}
                type="button"
                className={activeThumb === i ? "is-active" : ""}
                onClick={() => scrollToSlide(i)}
              >
                <ProductImage src={src} alt="" width={72} height={72} />
              </button>
            ))}
          </div>

          <div className="pdp-gallery__main">
            <div
              className="pdp-gallery__swipe"
              ref={swipeRef}
              aria-label="Product images"
            >
              {gallery.map((src, i) => (
                <div key={`${src}-${i}`} className="pdp-gallery__slide">
                  <ProductImage
                    src={src}
                    alt={i === 0 ? product.name : ""}
                    width={1200}
                    height={1200}
                    priority={i === 0}
                  />
                </div>
              ))}
            </div>
            <div className="pdp-gallery__desktop-only">
              <ProductImage
                src={gallery[activeThumb] ?? ""}
                alt={product.name}
                width={1200}
                height={1200}
                priority
              />
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
              <p style={{ margin: "12px 0" }}>{product.description}</p>
            )}

            {product.variants.length > 0 && (
              <div className="pdp-options">
                <label>Metal</label>
                <div className="pdp-variants-list" style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
                  {product.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className={`btn ${v.id === selectedVariantId ? "btn-primary" : "btn-secondary"}`}
                      style={{ fontSize: "0.8125rem", padding: "6px 12px" }}
                      onClick={() => setSelectedVariantId(v.id)}
                    >
                      {METAL_LABELS[v.metalType] ?? v.metalType}
                      {v.size ? ` — ${v.size}` : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {product.comingSoon ? (
              <p style={{ margin: "16px 0", fontWeight: 600 }}>Coming Soon</p>
            ) : (
              <div className="pdp-actions pdp-actions--inline" style={{ marginTop: 16 }}>
                <a
                  href={`https://wa.me/917075486464?text=${whatsappText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                >
                  Enquire on WhatsApp
                </a>
                <WishlistButton
                  productId={product.id}
                  productName={product.name}
                />
              </div>
            )}

            <ul className="pdp-info__trust" aria-label="Product guarantees" style={{ marginTop: 24 }}>
              {compareTrustItems.map(({ label }) => (
                <li key={label} className="pdp-info__trust-label">
                  {label}
                </li>
              ))}
            </ul>

            <div className="pdp-section pdp-section--trust-help" style={{ marginTop: 24 }}>
              <CommerceTrustHelpPanel className="plp-bottom--flush" />
            </div>
          </div>
        </div>
      </main>

      <PdpStickyBar
        price={price}
        onAddToCart={openCartModal}
        expertLabel="Enquire on WhatsApp"
      />
    </PageShell>
  );
}

export default function ProductPageClient({ product, goldRates }: Props) {
  return (
    <CartModalProvider bagCount={0}>
      <PdpContent product={product} goldRates={goldRates} />
    </CartModalProvider>
  );
}
