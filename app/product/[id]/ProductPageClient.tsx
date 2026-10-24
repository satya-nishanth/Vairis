"use client";

import Link from "next/link";
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
import {
  calculatePrice,
  feeLabelsFromConfig,
  type PricingConfig,
  type PriceBreakdown,
  type StoneInput,
} from "@/lib/pricing";
import { resolvePiecePricingConfig, type StoneView } from "@/lib/pricing-data";
import type { Product } from "@/lib/ui-data";
import { track } from "@/lib/analytics-client";
import { colorMeta, purityMeta } from "@/lib/metal";

type Variant = {
  id: string;
  pieceId: string | null;
  metalType: string;
  metalColor?: string;
  weightGrams: string;
  makingChargePerGram: string;
  flatMakingCharge: string;
  stoneCharges: string;
  miscCharges: string;
  certificationCharges?: string;
  packagingCharges?: string;
  deliveryCharges?: string;
  sku: string | null;
  size: string | null;
};

function variantColor(v: Variant): string {
  return v.metalColor ?? "YELLOW";
}

function sameMetalOption(v: Variant, purity: string, color: string): boolean {
  return v.metalType === purity && variantColor(v) === color;
}

type PieceView = {
  id: string;
  name: string;
  vaGoldPct: number | null;
  vaLabel: string | null;
  stones: StoneView[];
  variants: Variant[];
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
  pieces: PieceView[];
  stoneType?: string | null;
  caratWeight?: string | null;
  vaGoldPct?: number | null;
  vaLabel?: string | null;
  labels?: string[];
  /** Display-only automatic discount % (authoritative at checkout). */
  autoDiscountPercent?: number | null;
  /** Customer-facing reason for the discount (admin “Display name”). */
  autoDiscountDisplayName?: string | null;
};

type Props = {
  product: ProductData;
  goldRates: { metalType: string; ratePerGram: string }[];
  pricingConfig: PricingConfig;
  relatedProducts?: Product[];
};

function pieceBreakdown(
  piece: PieceView,
  variant: Variant,
  rate: number | undefined,
  storePricing: PricingConfig,
  productOverride: { vaGoldPct?: number | null; vaLabel?: string | null } | null,
  withExchange: boolean,
): PriceBreakdown | undefined {
  if (!rate || !(Number(variant.weightGrams) > 0)) return undefined;
  const config = resolvePiecePricingConfig(storePricing, productOverride, piece);
  const stones: StoneInput[] = piece.stones.map((s) => ({
    caratWeight: s.caratWeight,
    ratePerCarat: s.ratePerCarat,
    ratePerCaratExchange: s.ratePerCaratExchange,
    typeLabel: s.typeLabel,
  }));
  return calculatePrice(
    {
      weightGrams: Number(variant.weightGrams),
      makingChargePerGram: Number(variant.makingChargePerGram),
      flatMakingCharge: Number(variant.flatMakingCharge),
      stoneCharges: Number(variant.stoneCharges),
      miscCharges: Number(variant.miscCharges),
      certificationCharges:
        variant.certificationCharges === "" || variant.certificationCharges == null
          ? null
          : Number(variant.certificationCharges),
      packagingCharges:
        variant.packagingCharges === "" || variant.packagingCharges == null
          ? null
          : Number(variant.packagingCharges),
      deliveryCharges:
        variant.deliveryCharges === "" || variant.deliveryCharges == null
          ? null
          : Number(variant.deliveryCharges),
    },
    rate,
    { stones, withExchange, config },
  );
}

const COLOR_SWATCH: Record<string, string> = { YELLOW: "#D9B45A", WHITE: "#E3E3E0", ROSE: "#E8B8A0" };

function PdpContent({ product, goldRates, pricingConfig, relatedProducts }: Props) {
  const feeLabels = feeLabelsFromConfig(pricingConfig);
  const { openCartModal } = useCartModal();
  const { addItem, isLoggedIn, hydrated } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [addingToCart, setAddingToCart] = useState(false);
  const [buyingNow, setBuyingNow] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [activeThumb, setActiveThumb] = useState(0);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const paramMetal = searchParams?.get("metal");
  const paramColor = searchParams?.get("color");
  const paramSize = searchParams?.get("size");

  const multiPiece = product.pieces.length > 1;
  const allVariants = product.pieces.flatMap((p) => p.variants);
  const allStones = product.pieces.flatMap((p) => p.stones);
  const productOverride = {
    vaGoldPct: product.vaGoldPct ?? null,
    vaLabel: product.vaLabel ?? null,
  };

  const initialVariant = useMemo(() => {
    if (paramMetal || paramColor || paramSize) {
      const match = allVariants.find((v) => {
        const metalMatch = !paramMetal || v.metalType.toLowerCase() === paramMetal.toLowerCase();
        const colorMatch =
          !paramColor || variantColor(v).toLowerCase() === paramColor.toLowerCase();
        const sizeMatch = !paramSize || v.size === paramSize;
        return metalMatch && colorMatch && sizeMatch;
      });
      if (match) return match.id;
    }
    return product.pieces[0]?.variants[0]?.id ?? null;
  }, [allVariants, product.pieces, paramMetal, paramColor, paramSize]);

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(initialVariant);
  const swipeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedVariantId) return;
    const variant = allVariants.find((v) => v.id === selectedVariantId);
    if (!variant) return;
    const url = new URL(window.location.href);
    let changed = false;
    if (variant.metalType && url.searchParams.get("metal") !== variant.metalType) {
      url.searchParams.set("metal", variant.metalType);
      changed = true;
    }
    const color = variantColor(variant);
    if (url.searchParams.get("color") !== color) {
      url.searchParams.set("color", color);
      changed = true;
    }
    if (variant.size && url.searchParams.get("size") !== variant.size) {
      url.searchParams.set("size", variant.size);
      changed = true;
    }
    if (changed) {
      window.history.replaceState(null, "", url.toString());
    }
  }, [selectedVariantId, allVariants]);

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

  const selectedVariant = allVariants.find((v) => v.id === selectedVariantId);
  const [withExchange, setWithExchange] = useState(false);
  const hasStones = allStones.length > 0;

  type PiecePriced = {
    piece: PieceView;
    variant: Variant;
    breakdown: PriceBreakdown;
    weightGrams: number;
  };

  // Per-piece breakups; set total = sum. Multi-piece requires every piece to
  // price at the selected metal (same rule as cart/checkout).
  const pricePiecesFor = (exchange: boolean): PiecePriced[] | null => {
    if (!selectedVariant && !allVariants.length) return null;
    const purity = selectedVariant?.metalType ?? allVariants[0]?.metalType;
    const color = selectedVariant
      ? variantColor(selectedVariant)
      : allVariants[0]
        ? variantColor(allVariants[0])
        : "YELLOW";
    if (!purity) return null;
    const out: PiecePriced[] = [];
    for (const piece of product.pieces) {
      const v = piece.variants.find((x) => sameMetalOption(x, purity, color));
      if (!v) return null;
      const part = pieceBreakdown(
        piece,
        v,
        rateMap[v.metalType],
        pricingConfig,
        productOverride,
        exchange,
      );
      if (!part) return null;
      out.push({ piece, variant: v, breakdown: part, weightGrams: Number(v.weightGrams) });
    }
    return out.length ? out : null;
  };

  const piecePrices = pricePiecesFor(withExchange) ?? [];
  const price =
    piecePrices.length > 0
      ? Math.round(piecePrices.reduce((sum, p) => sum + p.breakdown.total, 0))
      : undefined;
  const priceWithoutPieces = pricePiecesFor(false);
  const priceWithPieces = pricePiecesFor(true);
  const priceWithoutTotal =
    priceWithoutPieces && priceWithoutPieces.length > 0
      ? priceWithoutPieces.reduce((sum, p) => sum + p.breakdown.total, 0)
      : undefined;
  const priceWithTotal =
    priceWithPieces && priceWithPieces.length > 0
      ? priceWithPieces.reduce((sum, p) => sum + p.breakdown.total, 0)
      : undefined;

  const discPct = product.autoDiscountPercent && product.autoDiscountPercent > 0 ? product.autoDiscountPercent : 0;
  const afterDisc = (n: number) => Math.max(0, Math.round(Math.round(n) * (1 - discPct / 100)));
  const planPrice = (n: number) =>
    discPct ? (
      <>
        <s className="pdp-plan__was">{inr(n)}</s> {inr(afterDisc(n))}
      </>
    ) : (
      inr(n)
    );
  const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
  // Exchange value shown under Lifetime Value: gold at 100%, diamonds at 90%.
  const exchangeGold = (priceWithPieces ?? []).reduce((t, p) => t + p.breakdown.goldValue, 0);
  const exchangeDiamond =
    0.9 * (priceWithPieces ?? []).reduce((t, p) => t + p.breakdown.stoneValue, 0);

  // Purity + color available on every piece (same rule as set pricing).
  const purities = product.pieces.reduce<string[]>((acc, piece, i) => {
    const piecePurities = [...new Set(piece.variants.map((v) => v.metalType))];
    if (i === 0) return piecePurities;
    return acc.filter((m) => piecePurities.includes(m));
  }, []);

  const colorsForPurity = (purity: string) =>
    product.pieces.reduce<string[]>((acc, piece, i) => {
      const pieceColors = [
        ...new Set(
          piece.variants.filter((v) => v.metalType === purity).map((v) => variantColor(v)),
        ),
      ];
      if (i === 0) return pieceColors;
      return acc.filter((c) => pieceColors.includes(c));
    }, []);

  const primaryPiece = product.pieces[0];
  const selectedPurity =
    selectedVariant && purities.includes(selectedVariant.metalType)
      ? selectedVariant.metalType
      : purities[0];
  const colorsForSelected = selectedPurity ? colorsForPurity(selectedPurity) : [];
  const selectedColor =
    selectedVariant && colorsForSelected.includes(variantColor(selectedVariant))
      ? variantColor(selectedVariant)
      : colorsForSelected[0] ?? "YELLOW";

  const pickVariantForMetal = (purity: string, color: string) => {
    const sameSize = primaryPiece?.variants.find(
      (v) => sameMetalOption(v, purity, color) && v.size === selectedVariant?.size,
    );
    const fallback =
      primaryPiece?.variants.find((v) => sameMetalOption(v, purity, color)) ??
      allVariants.find((v) => sameMetalOption(v, purity, color));
    setSelectedVariantId((sameSize ?? fallback)?.id ?? null);
  };

  useEffect(() => {
    if (!selectedPurity || !selectedColor) return;
    if (selectedVariant && sameMetalOption(selectedVariant, selectedPurity, selectedColor)) {
      return;
    }
    pickVariantForMetal(selectedPurity, selectedColor);
  }, [selectedPurity, selectedColor, selectedVariant, primaryPiece, allVariants]);

  // Sizes from the primary (first) piece — size is a product option, not a second line item.
  const sizesForMetal = (primaryPiece?.variants ?? []).filter(
    (v) => sameMetalOption(v, selectedPurity, selectedColor) && v.size,
  );

  const selectPurity = (purity: string) => {
    const colors = colorsForPurity(purity);
    const color = colors.includes(selectedColor) ? selectedColor : colors[0] ?? "YELLOW";
    pickVariantForMetal(purity, color);
  };

  const selectColor = (color: string) => {
    if (!selectedPurity) return;
    pickVariantForMetal(selectedPurity, color);
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
  const canAddToCart = CHECKOUT_ENABLED && product.showPrice && price != null;

  // Deterministic on server and client (unlike window.location.href, which
  // differs between SSR and the browser and causes a hydration mismatch —
  // the href would silently stick to the server-rendered value).
  const productUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/product/${product.id}`;

  const handleAddToCart = async () => {
    if (!selectedVariant) return;
    if (hydrated && !isLoggedIn) {
      router.push(`/auth/login?next=${encodeURIComponent(`/product/${product.id}`)}&reason=cart`);
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

  const handleBuyNow = async () => {
    if (!selectedVariant) return;
    if (hydrated && !isLoggedIn) {
      router.push(`/auth/login?next=${encodeURIComponent("/checkout")}&reason=checkout`);
      return;
    }
    setBuyingNow(true);
    setCartError(null);
    try {
      await addItem(selectedVariant.id, 1, withExchange);
      track("buy_now", {
        productId: product.id,
        meta: { variantId: selectedVariant.id, withExchange, price },
      });
      router.push("/checkout");
    } catch {
      setCartError("Couldn't proceed to checkout. Please try again.");
    } finally {
      setBuyingNow(false);
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
          { label: "Collections", href: "/collections" },
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

            {product.labels && product.labels.length > 0 && (
              <div
                className="pdp-info__labels"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "6px",
                  marginTop: "8px",
                  marginBottom: "12px",
                }}
              >
                <span
                  style={{
                    fontSize: "0.75rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--color-muted, #6b7280)",
                    fontWeight: 600,
                    marginRight: "4px",
                  }}
                >
                  Styles &amp; Labels:
                </span>
                {product.labels.map((lbl) => (
                  <Link
                    key={lbl}
                    href={`/all-products/${categorySlug}?style=${encodeURIComponent(lbl)}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      fontSize: "0.75rem",
                      fontWeight: 500,
                      backgroundColor: "var(--color-bg-secondary, #f3f4f6)",
                      color: "var(--color-text, #111827)",
                      border: "1px solid var(--color-border, #e5e7eb)",
                      textDecoration: "none",
                      transition: "all 0.15s ease",
                    }}
                    title={`Browse all ${categoryLabel} in ${lbl}`}
                  >
                    <span style={{ fontSize: "0.75rem" }}>🏷️</span>
                    <span>{lbl}</span>
                  </Link>
                ))}
              </div>
            )}

            {product.showPrice && price != null ? (
              <>
                <p className="pdp-info__price">
                  {product.autoDiscountPercent && product.autoDiscountPercent > 0 ? (
                    <>
                      <span style={{ textDecoration: "line-through", opacity: 0.55, marginRight: 10 }}>
                        ₹{price.toLocaleString("en-IN")}
                      </span>
                      ₹
                      {Math.max(
                        0,
                        Math.round(price * (1 - product.autoDiscountPercent / 100)),
                      ).toLocaleString("en-IN")}
                      <span className="pdp-info__meta"> incl. GST</span>
                    </>
                  ) : (
                    <>
                      ₹{price.toLocaleString("en-IN")}
                      <span className="pdp-info__meta"> incl. GST</span>
                    </>
                  )}
                </p>
                {product.autoDiscountPercent && product.autoDiscountPercent > 0 && (
                    <p
                      className="pdp-info__discount-label"
                      data-testid="pdp-discount-display-name"
                    >
                      {product.autoDiscountDisplayName
                        ? `Discount: ${product.autoDiscountDisplayName} - ${Math.round(product.autoDiscountPercent)}% Off`
                        : `Discount: ${Math.round(product.autoDiscountPercent)}% Off`}
                    </p>
                  )}
              </>
            ) : (
              !product.showPrice && <p className="pdp-info__price pdp-info__price--on-request">Price on Request</p>
            )}

            {product.description && (
              <p className="pdp-info__description">{product.description}</p>
            )}

            {multiPiece && (
              <p className="pdp-info__meta" data-testid="pdp-set-note">
                Complete set price — one product, not separate items.
              </p>
            )}

            {hasStones
              ? product.pieces.map((piece) =>
                  piece.stones.length > 0 ? (
                    <div
                      key={piece.id}
                      className="pdp-options"
                      data-testid={multiPiece ? `pdp-stones-${piece.id}` : "pdp-stones"}
                    >
                      <label>{multiPiece ? `Diamonds — ${piece.name}` : "Diamonds"}</label>
                      <ul className="pdp-info__stones">
                        {piece.stones.map((s) => (
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
                            <div className="pdp-info__stone-total">
                              <span className="pdp-info__stone-total-label">Total weight</span>
                              <span className="pdp-info__stone-carat">
                                {s.caratWeight.toFixed(2)} ct
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null,
                )
              : product.caratWeight && Number(product.caratWeight) > 0 ? (
                  <div className="pdp-options" data-testid="pdp-stones">
                    <label>Diamonds</label>
                    <ul className="pdp-info__stones">
                      <li className="pdp-info__stone">
                        <span className="pdp-info__stone-label">
                          <ThemeIcon
                            name="vairis_diamond_mark"
                            category="brand"
                            size={16}
                            className="pdp-info__stone-icon"
                          />
                          {product.stoneType || "Natural Diamond"}
                        </span>
                        <div className="pdp-info__stone-total">
                          <span className="pdp-info__stone-total-label">Total weight</span>
                          <span className="pdp-info__stone-carat">
                            {Number(product.caratWeight).toFixed(2)} ct
                          </span>
                        </div>
                      </li>
                    </ul>
                  </div>
                ) : null}

            {purities.length > 0 && (
              <div className="pdp-options pdp-gold">
                <div className="pdp-gold__head">
                  <label>Gold purity</label>
                  <span>BIS hallmarked</span>
                </div>
                <div className="pdp-variants">
                  {purities.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`pdp-purity${m === selectedPurity ? " is-selected" : ""}`}
                      aria-pressed={m === selectedPurity}
                      onClick={() => selectPurity(m)}
                    >
                      {purityMeta(m)?.label ?? m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {colorsForSelected.length > 0 && (
              <div className="pdp-options" data-testid="pdp-metal-color">
                <label>
                  Colour
                  {selectedColor && (
                    <span className="pdp-colour__name"> · {colorMeta(selectedColor)?.shortLabel ?? selectedColor}</span>
                  )}
                </label>
                <div className="pdp-variants pdp-colours">
                  {colorsForSelected.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`pdp-swatch${c === selectedColor ? " is-selected" : ""}`}
                      style={{ background: COLOR_SWATCH[c] ?? "#ddd" }}
                      aria-label={`${colorMeta(c)?.shortLabel ?? c} gold`}
                      aria-pressed={c === selectedColor}
                      onClick={() => selectColor(c)}
                    />
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

            {product.showPrice &&
              hasStones &&
              priceWithTotal != null &&
              priceWithoutTotal != null &&
              Math.round(priceWithTotal) !== Math.round(priceWithoutTotal) && (
              <section className="pdp-plans" data-testid="pdp-exchange" aria-label="Choose your plan">
                <h2 className="pdp-plans__title">Choose your plan</h2>
                <p className="pdp-plans__intro">
                  Same piece, same diamonds. Lifetime Value adds exchange value and lifetime
                  care. Standard is the piece only.
                </p>
                <div className="pdp-plans__cards" role="radiogroup" aria-label="Plan">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={withExchange}
                    className={`pdp-plan pdp-plan--value${withExchange ? " is-selected" : ""}`}
                    onClick={() => setWithExchange(true)}
                  >
                    <span className="pdp-plan__tag">Recommended · Most chosen</span>
                    <span className="pdp-plan__body">
                      <span className="pdp-plan__radio" aria-hidden="true" />
                      <span className="pdp-plan__head">
                        <span className="pdp-plan__name">Lifetime Value</span>
                        <span className="pdp-plan__price">{planPrice(priceWithTotal)}</span>
                        <span className="pdp-plan__sub">Exchange value + lifetime care</span>
                        <span className="pdp-plan__delta">
                          +{inr(afterDisc(priceWithTotal) - afterDisc(priceWithoutTotal))}
                        </span>
                      </span>
                      <ul className="pdp-plan__perks">
                        <li>
                          <span>
                            <b>100% gold value</b>{" "}towards an exchange, at that day&rsquo;s gold rate
                          </span>
                        </li>
                        <li>
                          <span>
                            <b>90% diamond value</b>{" "}towards an exchange
                          </span>
                        </li>
                        <li>
                          <span>
                            <b>Free service for life</b>{" "}for any damage
                          </span>
                        </li>
                        <li>
                          <span>
                            <b>Lifetime support</b>
                          </span>
                        </li>
                      </ul>
                    </span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!withExchange}
                    className={`pdp-plan${!withExchange ? " is-selected" : ""}`}
                    onClick={() => setWithExchange(false)}
                  >
                    <span className="pdp-plan__body">
                      <span className="pdp-plan__radio" aria-hidden="true" />
                      <span className="pdp-plan__head">
                        <span className="pdp-plan__name">Standard</span>
                        <span className="pdp-plan__price">{planPrice(priceWithoutTotal)}</span>
                        <span className="pdp-plan__sub">Piece only</span>
                      </span>
                      <ul className="pdp-plan__perks">
                        <li>IGI certified diamond, BIS hallmarked gold</li>
                        <li>Easy returns</li>
                      </ul>
                    </span>
                  </button>
                </div>
                <div className="pdp-plans__value">
                  <p>
                    With Lifetime Value, this piece carries up to <b>{inr(exchangeGold + exchangeDiamond)}</b> in
                    exchange value towards your next Vairis piece*
                  </p>
                  <span>
                    Gold {inr(exchangeGold)}* (100%) + Diamond {inr(exchangeDiamond)}* (90%)
                  </span>
                </div>
                <table className="pdp-plans__table">
                  <caption>Compare the plans</caption>
                  <thead>
                    <tr>
                      <th scope="col"><span className="sr-only">Benefit</span></th>
                      <th scope="col">Standard</th>
                      <th scope="col">Lifetime Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th scope="row">Gold exchange value*</th>
                      <td><span className="pdp-plans__no" role="img" aria-label="Not included">✕</span></td>
                      <td>✓ 100% · {inr(exchangeGold)}</td>
                    </tr>
                    <tr>
                      <th scope="row">Diamond exchange value*</th>
                      <td><span className="pdp-plans__no" role="img" aria-label="Not included">✕</span></td>
                      <td>✓ 90% · {inr(exchangeDiamond)}</td>
                    </tr>
                    <tr>
                      <th scope="row">Service for damage</th>
                      <td>Paid</td>
                      <td>✓ Free, for life</td>
                    </tr>
                    <tr>
                      <th scope="row">Lifetime support</th>
                      <td><span className="pdp-plans__no" role="img" aria-label="Not included">✕</span></td>
                      <td>✓ Included</td>
                    </tr>
                  </tbody>
                </table>
                <p className="pdp-plans__fine">
                  *Exchange value is credit towards a new Vairis piece, not a cash refund. Gold is
                  valued at the rate on the day you exchange; today&rsquo;s rate is shown. Diamond
                  value is 90% of the Lifetime Value diamond price.
                </p>
              </section>
            )}

            {product.showPrice && piecePrices.length > 0 && (
              <div className="pdp-info__breakups" data-testid="pdp-breakup">
                {piecePrices.map(({ piece, breakdown, weightGrams }) => {
                  const roundedGold = Math.round(breakdown.goldValue);
                  const roundedStones =
                    breakdown.stoneLines.length > 0
                      ? breakdown.stoneLines.reduce((sum, l) => sum + Math.round(l.value), 0)
                      : Math.round(breakdown.stoneValue);
                  const roundedMaking = Math.round(breakdown.making);
                  const roundedVA = breakdown.goldVA > 0 ? Math.round(breakdown.goldVA) : 0;
                  const roundedMisc =
                    breakdown.miscCharges > 0 ? Math.round(breakdown.miscCharges) : 0;
                  const roundedCert =
                    breakdown.certificationCharges > 0
                      ? Math.round(breakdown.certificationCharges)
                      : 0;
                  const roundedPack =
                    breakdown.packagingCharges > 0
                      ? Math.round(breakdown.packagingCharges)
                      : 0;
                  const roundedDel =
                    breakdown.deliveryCharges > 0
                      ? Math.round(breakdown.deliveryCharges)
                      : 0;
                  const roundedGST = Math.round(breakdown.gst);
                  // Match header price: round once on formula total (not sum of rounded lines).
                  const tableTotal = Math.round(breakdown.total);
                  return (
                    <details
                      key={piece.id}
                      className="pdp-info__breakup"
                    >
                      <summary>
                        {multiPiece ? `Price breakup — ${piece.name}` : "Price Breakup"}
                      </summary>
                      <table>
                        <tbody>
                          <tr>
                            <td>Gold value ({weightGrams.toFixed(3)} g)</td>
                            <td>₹{roundedGold.toLocaleString("en-IN")}</td>
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
                          {breakdown.stoneLines.length === 0 &&
                            (breakdown.stoneValue > 0 ||
                              (product.caratWeight && Number(product.caratWeight) > 0)) && (
                              <tr>
                                <td>
                                  {product.stoneType || "Diamond"}
                                  {product.caratWeight && Number(product.caratWeight) > 0
                                    ? ` (${Number(product.caratWeight).toFixed(2)} ct)`
                                    : ""}
                                </td>
                                <td>
                                  {breakdown.stoneValue > 0
                                    ? `₹${Math.round(breakdown.stoneValue).toLocaleString("en-IN")}`
                                    : "Included"}
                                </td>
                              </tr>
                            )}
                          <tr>
                            <td>Making charges</td>
                            <td>₹{roundedMaking.toLocaleString("en-IN")}</td>
                          </tr>
                          {roundedVA > 0 && (
                            <tr>
                              <td>{breakdown.vaLabel}</td>
                              <td>₹{roundedVA.toLocaleString("en-IN")}</td>
                            </tr>
                          )}
                          {roundedCert > 0 && (
                            <tr>
                              <td>{feeLabels.certification}</td>
                              <td>₹{roundedCert.toLocaleString("en-IN")}</td>
                            </tr>
                          )}
                          {roundedPack > 0 && (
                            <tr>
                              <td>{feeLabels.packaging}</td>
                              <td>₹{roundedPack.toLocaleString("en-IN")}</td>
                            </tr>
                          )}
                          {roundedDel > 0 && (
                            <tr>
                              <td>{feeLabels.delivery}</td>
                              <td>₹{roundedDel.toLocaleString("en-IN")}</td>
                            </tr>
                          )}
                          {roundedMisc > 0 && (
                            <tr>
                              <td>Misc</td>
                              <td>₹{roundedMisc.toLocaleString("en-IN")}</td>
                            </tr>
                          )}
                          <tr>
                            <td>GST</td>
                            <td>₹{roundedGST.toLocaleString("en-IN")}</td>
                          </tr>
                          <tr className="pdp-info__breakup-total">
                            <td>{multiPiece ? `${piece.name} total` : "Total"}</td>
                            <td>₹{tableTotal.toLocaleString("en-IN")}</td>
                          </tr>
                        </tbody>
                      </table>
                    </details>
                  );
                })}
                {multiPiece && price != null && (
                  <p className="pdp-info__set-total" data-testid="pdp-set-total">
                    Set total{" "}
                    <strong>₹{price.toLocaleString("en-IN")}</strong>
                    <span className="pdp-info__meta"> incl. GST</span>
                  </p>
                )}
              </div>
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
          price={
            product.showPrice && price != null
              ? product.autoDiscountPercent && product.autoDiscountPercent > 0
                ? Math.max(
                    0,
                    Math.round(price * (1 - product.autoDiscountPercent / 100)),
                  )
                : price
              : undefined
          }
          wasPrice={product.showPrice && price != null && discPct ? price : undefined}
          planLabel={
            hasStones && priceWithTotal != null && priceWithoutTotal != null &&
            Math.round(priceWithTotal) !== Math.round(priceWithoutTotal)
              ? `${purityMeta(selectedPurity)?.label ?? ""} · ${withExchange ? "Lifetime Value" : "Standard"}`
              : undefined
          }
          switchNudge={
            hasStones && !withExchange && priceWithTotal != null && priceWithoutTotal != null &&
            Math.round(priceWithTotal) !== Math.round(priceWithoutTotal)
              ? {
                  text: `Lifetime Value: +${inr(afterDisc(priceWithTotal) - afterDisc(priceWithoutTotal))}, up to ${inr(exchangeGold + exchangeDiamond)} exchange value`,
                  onSwitch: () => setWithExchange(true),
                }
              : undefined
          }
          onAddToCart={handleAddToCart}
          addingToCart={addingToCart}
          onBuyNow={handleBuyNow}
          buyingNow={buyingNow}
          expertLabel="Enquire on WhatsApp"
          onExpertClick={() => setQuoteModalOpen(true)}
          canPurchase={product.showPrice && price != null}
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
