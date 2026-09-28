import type { Metadata } from "next";
import { Fragment } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { TrustBar } from "@/components/layout/TrustBar";
import { Container } from "@/components/ui/Container";
import { Section, SectionHeader } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { CategoryCarouselSection } from "@/components/commerce/CategoryCarouselSection";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { TestimonialCard } from "@/components/content/TestimonialCard";
import { ProductImage } from "@/components/ui/ProductImage";
import { MarketingImage } from "@/components/ui/MarketingImage";
import { WhyVairisLandingImage } from "@/components/home/WhyVairisLandingImage";
import { HomeSectionHead } from "@/components/home/HomeSectionHead";
import { IconChevronRight, SharedIcon, ThemeIcon } from "@/components/icons/ThemeIcon";
import { pageLayouts } from "@/lib/layout-config";
import { categories, getHeroSlides, testimonials } from "@/lib/ui-data";
import { founderVideos, instagramVideos, howItWorksSteps, whyVairisFeatures } from "@/lib/home-content";
import { categoryHref } from "@/lib/catalogue-ui";
import { marketingImages } from "@/lib/images";
import { getBanner } from "@/lib/site-content";
import { getActiveHomeSections } from "@/lib/home-sections";
import { HomeDbSections } from "@/components/home/HomeDbSections";
import { getHomeCategoryCarouselItems } from "@/lib/home-categories";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "VAIRIS | Everyday Diamond & Fine Jewellery",
  description: "Minimal diamond jewellery in 18kt and 14kt gold. Solitaire rings, bracelets, pendants, and earrings for everyday elegance.",
};

export default async function HomePage() {
  const layout = pageLayouts.home;
  // Admin-customizable hero (slot "home-hero", /admin/content) — every
  // field falls back to the built-in copy below when unset.
  const [hero, dbSections, homeCategories] = await Promise.all([
    getBanner("home-hero"),
    getActiveHomeSections().catch(() => []),
    getHomeCategoryCarouselItems().catch(() => categories),
  ]);

  return (
    <PageShell {...layout}>
      <main className="home-main">
        <Section className="section--shop-categories section--shop-categories--mobile-only">
          <CategoryCarouselSection categories={homeCategories} variant="compact" />
        </Section>

        <section className="hero">
          <div className="hero__content">
            <p className="hero__eyebrow">Everyday Diamond Wear</p>
            <h1 className="hero__title">{hero?.title ?? "Diamonds You'll Actually Wear."}</h1>
            <p className="hero__desc">
              {hero?.subtitle ??
                "Minimal diamond jewellery designed for work, coffee runs, date nights and everyday confidence."}
            </p>
            <div className="hero__ctas">
              <Button
                href={
                  hero?.linkUrl && hero.linkUrl !== "/all-products/necklaces"
                    ? hero.linkUrl
                    : categoryHref("rings")
                }
                variant="primary"
              >
                {hero?.ctaLabel ?? "Shop Now"}
              </Button>
            </div>
            {/* Honest trust line — fabricated review counts removed; real
                per-product ratings come from moderated customer reviews. */}
            <div className="hero__social">
              <div className="hero__avatars">
                {marketingImages.hero.socialAvatars.map((src) => (
                  <ProductImage key={src} src={src} alt="Customer" width={32} height={32} />
                ))}
              </div>
              <span>IGI Certified · BIS Hallmarked · Insured Delivery</span>
            </div>
          </div>
          <HeroCarousel
            slides={hero?.images?.length ? hero.images : hero?.imageUrl ? [hero.imageUrl] : getHeroSlides()}
            imageFits={hero?.images?.length ? hero.imageFits : undefined}
            alt="Woman wearing minimal diamond jewellery"
          />
        </section>

        <div className="home-main__body">
        <TrustBar variant="full" />

        {/* Admin-managed sections (/admin/sections) render here, in order */}
        <HomeDbSections sections={dbSections} />

        <Section className="section--shop-categories section--shop-categories--desktop-only">
          <CategoryCarouselSection categories={homeCategories} variant="marquee" />
        </Section>

        <Section background="card" className="section--why-vairis">
          <Container>
            <HomeSectionHead title="Why VAIRIS?" />
            <div className="split why-vairis">
            <WhyVairisLandingImage />
            <div id="why" className="why-vairis__content">
              <ul className="feature-grid feature-grid--why">
                {whyVairisFeatures.map(({ icon, title, description }, i) => (
                  <li
                    key={title}
                    className={[
                      "feature-item",
                      i === 4 ? "feature-item--hide-mobile" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    data-span={i === 4 ? "solo" : undefined}
                  >
                    <span className="feature-item__icon" aria-hidden>
                      <ThemeIcon name={icon.name} category={icon.category} size={44} />
                    </span>
                    <div className="feature-item__body">
                      <h4>{title}</h4>
                      <p>{description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            </div>
          </Container>
        </Section>

        <Section className="section--founder-videos">
          <Container>
            <HomeSectionHead
              title="Our Stories"
              actionLabel="Follow @vairis.jewellery →"
              actionHref="https://www.instagram.com/vairis.jewellery/"
            />
            <div className="video-grid video-grid--reels">
              {instagramVideos.map(({ src, title, description, url, placeholder }) => (
                <a
                  key={title}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="video-card video-card--reel"
                  aria-label={`Watch ${title} on Instagram`}
                >
                  <div className="video-card__media">
                    <MarketingImage
                      src={src}
                      alt={title}
                      width={240}
                      height={426}
                      placeholderLabel={placeholder}
                    />
                    <div className="video-card__badge" aria-hidden>
                      <SharedIcon name="instagram" category="social" size={14} />
                      <span>Watch Reel</span>
                    </div>
                  </div>
                  <h3 className="video-card__title">
                    <span>{title}</span>
                    <span className="video-card__arrow" aria-hidden>↗</span>
                  </h3>
                  <p className="video-card__desc">{description}</p>
                </a>
              ))}
            </div>
          </Container>
        </Section>

        <Section background="muted" className="section--how-it-works">
          <Container>
            <HomeSectionHead title="How It Works" />
            <div className="how-steps">
              {howItWorksSteps.map(({ icon, title, description }, i) => (
                <Fragment key={title}>
                  {i > 0 && (
                    <div className="how-step__separator" aria-hidden>
                      <IconChevronRight />
                    </div>
                  )}
                  <div className="how-step">
                    <ThemeIcon name={icon.name} category={icon.category} size={40} className="how-step__icon" />
                    <h4>{title}</h4>
                    <p>{description}</p>
                  </div>
                </Fragment>
              ))}
            </div>
          </Container>
        </Section>

        <Section id="reviews">
          <Container>
            <SectionHeader title="What Our Customers Say" />
            <div className="grid-4 home-testimonials-scroll">
              {testimonials.map((t) => (
                <TestimonialCard key={t.name} {...t} />
              ))}
            </div>
          </Container>
        </Section>
        </div>
      </main>
    </PageShell>
  );
}
