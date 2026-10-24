"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useEffect, Suspense, Fragment } from "react";
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
import { PdpPromises } from "@/components/commerce/PdpPromises";
import { QuoteEnquiryModal } from "@/components/commerce/QuoteEnquiryModal";
import { useCart } from "@/components/commerce/CartProvider";
import { pageLayouts } from "@/lib/layout-config";
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
  totalLengthMm?: string | null;
  motifSizeMm?: string | null;
  thicknessMm?: string | null;
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

const DELIVERY_POINTS = [
  { title: "Free insured shipping across India", text: "Tamper-evident packaging; the courier hands over only after OTP confirmation.", icon: "M3 6h11v10H3zM14 10h4l3 3v3h-7M5 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0M15 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0" },
  { title: "Dispatched in 2–7 business days", text: "Made-to-order pieces take longer. Delivery takes 2–5 business days after dispatch.", icon: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18z" },
  { title: "Track every step", text: "Courier and AWB number sent when it ships; track from My Orders.", icon: "M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11zM12 8a2 2 0 1 0 0 4 2 2 0 1 0 0-4z" },
  { title: "15-day returns", text: "Contact us within 15 days of delivery. After a quick condition check, we refund to your original payment method.", icon: "M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4" },
];

function AccChevron() {
  return (
    <svg className="pdp-acc__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function listOr(items: string[]): string {
  const lower = items.map((x, i) => (i === 0 ? x : x.toLowerCase()));
  return lower.length > 1 ? `${lower.slice(0, -1).join(", ")} or ${lower[lower.length - 1]}` : (lower[0] ?? "");
}

function stoneSummary(stones: StoneView[]): string {
  const ct = stones.reduce((t, x) => t + x.caratWeight, 0);
  const desc = stones
    .map((x) => `${x.label ? `${x.label} — ` : ""}${x.typeLabel}${x.count ? ` × ${x.count}` : ""}`)
    .join(", ");
  return `${desc} · ${ct.toFixed(2)} ct · IGI`;
}

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
  const hasPlans =
    product.showPrice &&
    hasStones &&
    priceWithTotal != null &&
    priceWithoutTotal != null &&
    Math.round(priceWithTotal) !== Math.round(priceWithoutTotal);
  const careNote = hasPlans ? (withExchange ? "Included in your plan" : "With Lifetime Value") : null;
  const breakupPieces = hasPlans ? (priceWithoutPieces ?? []) : piecePrices;
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

  const detailRows = (() => {
    const rows: { label: string; value: string }[] = [];
    const weight = piecePrices.reduce((t, x) => t + x.weightGrams, 0);
    const stoneCt = allStones.reduce((t, x) => t + x.caratWeight, 0);
    if (product.itemCode) rows.push({ label: "Item code", value: product.itemCode });
    rows.push({ label: "Category", value: categoryLabel });
    if (selectedPurity) {
      rows.push({
        label: "Gold",
        value: `${purityMeta(selectedPurity)?.label ?? selectedPurity}${weight > 0 ? ` · ${weight.toFixed(3)} g` : ""} · BIS hallmarked`,
      });
    }
    if (colorsForSelected.length > 0) {
      rows.push({ label: "Gold colour", value: listOr(colorsForSelected.map((c) => colorMeta(c)?.shortLabel ?? c)) });
    }
    if (stoneCt > 0) {
      rows.push({
        label: "Diamonds",
        value: allStones.map((x) => `${x.label ? `${x.label} — ` : ""}${x.typeLabel}`).join(", "),
      });
      rows.push({ label: "Diamond weight", value: `${stoneCt.toFixed(2)} ct total · IGI certified` });
    } else if (product.caratWeight && Number(product.caratWeight) > 0) {
      rows.push({ label: "Diamonds", value: product.stoneType || "Natural Diamond" });
      rows.push({ label: "Diamond weight", value: `${Number(product.caratWeight).toFixed(2)} ct total · IGI certified` });
    }
    const dims: [string, string | null | undefined][] = [
      ["Length", product.totalLengthMm],
      ["Motif size", product.motifSizeMm],
      ["Thickness", product.thicknessMm],
    ];
    for (const [label, v] of dims) {
      if (v != null && Number(v) > 0) rows.push({ label, value: `${Number(v)} mm` });
    }
    return rows;
  })();

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
          <div className="pdp-gallery">
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

          <PdpPromises className="pdp-promises--gallery" careNote={careNote} />
          </div>

          <div className="pdp-info">
            <p className="pdp-info__meta pdp-info__eyebrow">
              {[product.itemCode, categoryLabel].filter(Boolean).join(" · ")}
            </p>
            <h1 className="pdp-info__title">{product.name}</h1>

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
              <div className="pdp-price">
                <div className="pdp-price__row">
                  <span className="pdp-price__now">{inr(afterDisc(price))}</span>
                  {discPct > 0 && (
                    <>
                      <s className="pdp-price__was">{inr(price)}</s>
                      <span className="pdp-price__tag">{Math.round(discPct)}% off</span>
                    </>
                  )}
                </div>
                <span className="pdp-price__note">
                  Incl. GST{hasPlans ? ` · ${withExchange ? "Lifetime Value" : "Standard"} plan` : ""}
                </span>
              </div>
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

            {(hasStones || (product.caratWeight && Number(product.caratWeight) > 0)) && (
              <dl className="pdp-rows" data-testid="pdp-stones">
                {hasStones ? (
                  product.pieces
                    .filter((piece) => piece.stones.length > 0)
                    .map((piece) => (
                      <div key={piece.id} className="pdp-rows__row">
                        <dt>{multiPiece ? `Diamonds — ${piece.name}` : "Diamonds"}</dt>
                        <dd>{stoneSummary(piece.stones)}</dd>
                      </div>
                    ))
                ) : (
                  <div className="pdp-rows__row">
                    <dt>Diamonds</dt>
                    <dd>
                      {product.stoneType || "Natural Diamond"} · {Number(product.caratWeight).toFixed(2)} ct · IGI
                    </dd>
                  </div>
                )}
              </dl>
            )}

            {purities.length > 0 && (
              <div className="pdp-opt">
                <span className="pdp-opt__label">
                  Gold purity
                  <span> · {purityMeta(selectedPurity ?? "")?.label ?? selectedPurity} · BIS hallmarked</span>
                </span>
                <div className="pdp-opt__chips" role="radiogroup" aria-label="Gold purity">
                  {purities.map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={m === selectedPurity}
                      className={`pdp-chip pdp-chip--purity${m === selectedPurity ? " is-selected" : ""}`}
                      onClick={() => selectPurity(m)}
                    >
                      {purityMeta(m)?.label ?? m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {colorsForSelected.length > 0 && (
              <div className="pdp-opt" data-testid="pdp-metal-color">
                <span className="pdp-opt__label">
                  Gold colour
                  <span> · {colorMeta(selectedColor)?.shortLabel ?? selectedColor} gold</span>
                </span>
                <div className="pdp-opt__chips" role="radiogroup" aria-label="Gold colour">
                  {colorsForSelected.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={c === selectedColor}
                      className={`pdp-chip pdp-chip--colour${c === selectedColor ? " is-selected" : ""}`}
                      onClick={() => selectColor(c)}
                    >
                      <i style={{ background: COLOR_SWATCH[c] ?? "#ddd" }} aria-hidden="true" />
                      {colorMeta(c)?.shortLabel ?? c}
                    </button>
                  ))}
                </div>
                {selectedColor !== "YELLOW" && (
                  <span className="pdp-opt__note">
                    Photos show yellow gold. Your piece is made in{" "}
                    {(colorMeta(selectedColor)?.shortLabel ?? selectedColor).toLowerCase()} gold.
                  </span>
                )}
              </div>
            )}

            {sizesForMetal.length > 0 && (
              <div className="pdp-opt" data-testid="pdp-sizes">
                <span className="pdp-opt__label">Size</span>
                <div className="pdp-opt__chips" role="radiogroup" aria-label="Size">
                  {sizesForMetal.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      role="radio"
                      aria-checked={v.id === selectedVariantId}
                      className={`pdp-chip pdp-chip--purity${v.id === selectedVariantId ? " is-selected" : ""}`}
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
                      <span className="pdp-plan__exch">
                        <span>Exchange value towards your next Vairis piece, up to*</span>
                        <b>{inr(exchangeGold + exchangeDiamond)}</b>
                      </span>
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
                      <th scope="row">Gold exchange<span className="pdp-plans__long"> value</span>*</th>
                      <td><span className="pdp-plans__no" role="img" aria-label="Not included">✕</span></td>
                      <td>✓ 100% · {inr(exchangeGold)}</td>
                    </tr>
                    <tr>
                      <th scope="row">Diamond exchange<span className="pdp-plans__long"> value</span>*</th>
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
                    className="btn btn-primary pdp-actions__add"
                    onClick={handleAddToCart}
                    disabled={addingToCart || !selectedVariant}
                  >
                    {addingToCart
                      ? "Adding…"
                      : `Add to cart${price != null ? ` · ${inr(afterDisc(price))}` : ""}`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setQuoteModalOpen(true)}
                  className={`btn ${canAddToCart ? "btn-secondary" : "btn-primary"} pdp-actions__enquire`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="1.8" aria-hidden="true">
                    <path d="M4 20l1.3-4A8 8 0 1 1 8 18.7L4 20z" />
                  </svg>
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

            <PdpPromises className="pdp-promises--info" careNote={careNote} />

            <div className="pdp-acc">
              {product.showPrice && breakupPieces.length > 0 && (
                <details className="pdp-acc__item" data-testid="pdp-breakup">
                  <summary>
                    <span>Price breakup</span>
                    <AccChevron />
                  </summary>
                  <dl className="pdp-acc__rows">
                    {breakupPieces.map(({ piece, breakdown, weightGrams }) => (
                      <Fragment key={piece.id}>
                        {multiPiece && (
                          <div className="pdp-acc__row pdp-acc__row--head">
                            <dt>{piece.name}</dt>
                          </div>
                        )}
                        <div className="pdp-acc__row">
                          <dt>
                            Gold, {purityMeta(selectedPurity ?? "")?.label ?? ""} ({weightGrams.toFixed(3)} g)
                          </dt>
                          <dd>{inr(breakdown.goldValue)}</dd>
                        </div>
                        {breakdown.stoneLines.map((l, i) => (
                          <div key={i} className="pdp-acc__row">
                            <dt>
                              {l.typeLabel} ({l.caratWeight.toFixed(2)} ct × ₹
                              {l.ratePerCarat.toLocaleString("en-IN")}/ct)
                            </dt>
                            <dd>{inr(l.value)}</dd>
                          </div>
                        ))}
                        {breakdown.stoneLines.length === 0 && breakdown.stoneValue > 0 && (
                          <div className="pdp-acc__row">
                            <dt>
                              {product.stoneType || "Diamond"}
                              {product.caratWeight && Number(product.caratWeight) > 0
                                ? ` (${Number(product.caratWeight).toFixed(2)} ct)`
                                : ""}
                            </dt>
                            <dd>{inr(breakdown.stoneValue)}</dd>
                          </div>
                        )}
                        <div className="pdp-acc__row">
                          <dt>Making charges</dt>
                          <dd>{inr(breakdown.making)}</dd>
                        </div>
                        {breakdown.goldVA > 0 && (
                          <div className="pdp-acc__row">
                            <dt>{breakdown.vaLabel}</dt>
                            <dd>{inr(breakdown.goldVA)}</dd>
                          </div>
                        )}
                        {breakdown.certificationCharges > 0 && (
                          <div className="pdp-acc__row">
                            <dt>{feeLabels.certification}</dt>
                            <dd>{inr(breakdown.certificationCharges)}</dd>
                          </div>
                        )}
                        {breakdown.packagingCharges > 0 && (
                          <div className="pdp-acc__row">
                            <dt>{feeLabels.packaging}</dt>
                            <dd>{inr(breakdown.packagingCharges)}</dd>
                          </div>
                        )}
                        {breakdown.deliveryCharges > 0 && (
                          <div className="pdp-acc__row">
                            <dt>{feeLabels.delivery}</dt>
                            <dd>{inr(breakdown.deliveryCharges)}</dd>
                          </div>
                        )}
                        {breakdown.miscCharges > 0 && (
                          <div className="pdp-acc__row">
                            <dt>Misc</dt>
                            <dd>{inr(breakdown.miscCharges)}</dd>
                          </div>
                        )}
                        <div className="pdp-acc__row">
                          <dt>GST</dt>
                          <dd>{inr(breakdown.gst)}</dd>
                        </div>
                      </Fragment>
                    ))}
                    {hasPlans && withExchange && price != null && priceWithoutTotal != null && (
                      <div className="pdp-acc__row">
                        <dt>Lifetime Value plan</dt>
                        <dd>{inr(price - Math.round(priceWithoutTotal))}</dd>
                      </div>
                    )}
                    {price != null && discPct > 0 && (
                      <>
                        <div className="pdp-acc__row">
                          <dt>Subtotal</dt>
                          <dd>{inr(price)}</dd>
                        </div>
                        <div className="pdp-acc__row pdp-acc__row--discount">
                          <dt>Discount · {Math.round(discPct)}% off</dt>
                          <dd>−{inr(price - afterDisc(price))}</dd>
                        </div>
                      </>
                    )}
                    {price != null && (
                      <div className="pdp-acc__row pdp-acc__row--total" data-testid="pdp-set-total">
                        <dt>
                          You pay{hasPlans ? ` · ${withExchange ? "Lifetime Value" : "Standard"}` : ""}
                        </dt>
                        <dd>{inr(afterDisc(price))}</dd>
                      </div>
                    )}
                  </dl>
                  <p className="pdp-acc__note">
                    {hasPlans && !withExchange && priceWithTotal != null
                      ? `With Lifetime Value, a “Lifetime Value plan” line is added and you pay ${inr(afterDisc(priceWithTotal))}. `
                      : ""}
                    Prices include GST.
                  </p>
                </details>
              )}

              <details className="pdp-acc__item">
                <summary>
                  <span>Product details</span>
                  <AccChevron />
                </summary>
                <dl className="pdp-acc__rows">
                  {detailRows.map((r) => (
                    <div key={r.label} className="pdp-acc__row">
                      <dt>{r.label}</dt>
                      <dd>{r.value}</dd>
                    </div>
                  ))}
                </dl>
              </details>

              <details className="pdp-acc__item">
                <summary>
                  <span>Delivery &amp; returns</span>
                  <AccChevron />
                </summary>
                <ul className="pdp-acc__list">
                  {DELIVERY_POINTS.map((d) => (
                    <li key={d.title}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d={d.icon} />
                      </svg>
                      <span>
                        <strong>{d.title}</strong>
                        <span>{d.text}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="pdp-acc__links">
                  <Link href="/policies/shipping">Shipping policy</Link> · <Link href="/returns">Return terms</Link>
                </p>
              </details>
            </div>

            <div className="pdp-section pdp-section--trust-help pdp-trust-help--info">
              <CommerceTrustHelpPanel className="plp-bottom--flush" lifetimeCareCopy />
            </div>
          </div>
        </div>

        <section className="pdp-why pdp-trust-help--band" aria-label="Why Vairis">
          <CommerceTrustHelpPanel heading="Why Vairis" lifetimeCareCopy />
        </section>

        {relatedProducts && relatedProducts.length > 0 && (
          <section className="pdp-related">
            <h2 className="pdp-section-title">You may also like</h2>
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
