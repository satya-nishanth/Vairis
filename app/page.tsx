import { Fragment } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { TrustBar } from "@/components/layout/TrustBar";
import { Container } from "@/components/ui/Container";
import { Section, SectionHeader } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { Rating } from "@/components/ui/Rating";
import { CategoryCarouselSection } from "@/components/commerce/CategoryCarouselSection";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { TestimonialCard } from "@/components/content/TestimonialCard";
import { ProductImage } from "@/components/ui/ProductImage";
import { MarketingImage } from "@/components/ui/MarketingImage";
import { WhyVairisLandingImage } from "@/components/home/WhyVairisLandingImage";
import { HomeSectionHead } from "@/components/home/HomeSectionHead";
import { IconChevronRight, ThemeIcon } from "@/components/icons/ThemeIcon";
import { pageLayouts } from "@/lib/layout-config";
import { categories, getHeroSlides, testimonials } from "@/lib/ui-data";
import { founderVideos, howItWorksSteps, whyVairisFeatures } from "@/lib/home-content";
import { categoryHref } from "@/lib/catalogue-ui";
import { marketingImages } from "@/lib/images";

export default function HomePage() {
  const layout = pageLayouts.home;

  return (
    <PageShell {...layout}>
      <main className="home-main">
        <Section className="section--shop-categories section--shop-categories--mobile-only">
          <CategoryCarouselSection categories={categories} variant="compact" />
        </Section>

        <section className="hero">
          <div className="hero__content">
            <p className="hero__eyebrow">Everyday Diamond Wear</p>
            <h1 className="hero__title">Diamonds You&apos;ll Actually Wear.</h1>
            <p className="hero__desc">
              Minimal diamond jewellery designed for work, coffee runs, date nights and everyday confidence.
            </p>
            <div className="hero__ctas">
              <Button href={categoryHref("necklaces")} variant="primary">
                Shop Now
              </Button>
            </div>
            <div className="hero__social">
              <div className="hero__avatars">
                {marketingImages.hero.socialAvatars.map((src) => (
                  <ProductImage key={src} src={src} alt="Customer" width={32} height={32} />
                ))}
              </div>
              <span>Loved by 10,000+ women</span>
              <Rating score="4.9" reviews="2,300+ reviews" />
            </div>
          </div>
          <HeroCarousel slides={getHeroSlides()} alt="Woman wearing minimal diamond jewellery" />
        </section>

        <div className="home-main__body">
        <TrustBar variant="full" />

        <Section className="section--shop-categories section--shop-categories--desktop-only">
          <CategoryCarouselSection categories={categories} variant="marquee" />
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
            <HomeSectionHead title="Founder Videos" actionLabel="Watch More →" actionHref="#" />
            <div className="video-grid">
              {founderVideos.map(({ src, title, description, placeholder }) => (
                <article key={title} className="video-card">
                  <div className="video-card__media">
                    <MarketingImage src={src} alt={title} width={640} height={360} placeholderLabel={placeholder} />
                    <div className="video-card__play" aria-hidden>
                      <ThemeIcon name="play_button" category="content" size={52} />
                    </div>
                  </div>
                  <h3 className="video-card__title">{title}</h3>
                  <p className="video-card__desc">{description}</p>
                </article>
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
            <SectionHeader title="Loved by 10,000+ Happy Customers" actionLabel="View All Reviews →" actionHref="#" />
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
