import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { ProductCard } from "@/components/commerce/ProductCard";
import { ProductImage } from "@/components/ui/ProductImage";
import { HomeSectionHead } from "@/components/home/HomeSectionHead";
import type { HomeSectionView } from "@/lib/home-sections";

/**
 * Renders admin-managed home sections (HomeSection table) in order.
 * Server component — receives pre-fetched section views.
 */
export function HomeDbSections({ sections }: { sections: HomeSectionView[] }) {
  if (sections.length === 0) return null;

  return (
    <>
      {sections.map((s) => {
        switch (s.kind) {
          case "collection-rail":
            if (s.products.length === 0) return null;
            return (
              <Section key={s.id} className="section--collection-rail">
                <Container>
                  <HomeSectionHead
                    title={s.title ?? "Curated For You"}
                    actionLabel="View All →"
                    actionHref={`/collections/${s.collectionSlug}`}
                  />
                  {s.subtitle && <p className="section-subtitle">{s.subtitle}</p>}
                  <div className="grid-4 home-testimonials-scroll">
                    {s.products.map((p) => (
                      <ProductCard key={p.catalogueId} product={p} />
                    ))}
                  </div>
                </Container>
              </Section>
            );
          case "editorial":
            return (
              <Section key={s.id} background="card" className="section--editorial">
                <Container>
                  <div className="split editorial-split">
                    {s.image && (
                      <div className="editorial-split__media">
                        <ProductImage src={s.image} alt={s.title ?? ""} width={900} height={700} />
                      </div>
                    )}
                    <div className="editorial-split__body">
                      {s.title && <h2>{s.title}</h2>}
                      {s.subtitle && <p>{s.subtitle}</p>}
                      {s.ctaLabel && s.ctaHref && (
                        <Button href={s.ctaHref} variant="primary">
                          {s.ctaLabel}
                        </Button>
                      )}
                    </div>
                  </div>
                </Container>
              </Section>
            );
          case "video":
            return (
              <Section key={s.id} className="section--cms-video">
                <Container>
                  {s.title && <HomeSectionHead title={s.title} />}
                  <video
                    src={s.url}
                    poster={s.poster ?? undefined}
                    controls
                    playsInline
                    style={{ width: "100%", borderRadius: 12 }}
                  />
                </Container>
              </Section>
            );
          case "usp":
            return (
              <Section key={s.id} background="muted" className="section--cms-usp">
                <Container>
                  {s.title && <HomeSectionHead title={s.title} />}
                  <div className="how-steps">
                    {s.items.map((item) => (
                      <div key={item.title} className="how-step">
                        {item.icon && <span style={{ fontSize: 28 }}>{item.icon}</span>}
                        <h4>{item.title}</h4>
                        {item.description && <p>{item.description}</p>}
                      </div>
                    ))}
                  </div>
                </Container>
              </Section>
            );
          default:
            return null;
        }
      })}
    </>
  );
}
