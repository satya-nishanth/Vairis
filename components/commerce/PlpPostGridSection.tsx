import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/Section";
import { ProductImage } from "@/components/ui/ProductImage";
import { CommerceTrustHelpPanel } from "@/components/commerce/CommerceTrustHelpPanel";
import { lifestyleScenes } from "@/lib/ui-data";
import { marketingImages } from "@/lib/images";

type PlpPostGridSectionProps = {
  category?: string;
};

export function PlpPostGridSection({ category }: PlpPostGridSectionProps) {
  const isMenCategory = category === "cufflinks";
  const title = isMenCategory
    ? "Refined Details. Real Everyday Style."
    : "Real People. Real Everyday Style.";

  return (
    <div className="plp-post-grid">
      <SectionHeader title={title} actionLabel="Explore Pieces →" actionHref="/all-products/rings" />

      <div className="ugc-row">
        {lifestyleScenes.map((scene) => (
          <div key={scene.id} className="ugc-item">
            <ProductImage src={scene.image} alt={scene.label} width={500} height={500} />
            <span>{scene.ugcLabel}</span>
          </div>
        ))}
      </div>

      <CommerceTrustHelpPanel />

      {/* Honest trust bar — no fabricated review counts. Real per-product
          ratings render on each PDP from moderated customer reviews. */}
      <div className="review-bar">
        <div className="review-bar__content">
          <div className="review-bar__avatars">
            {marketingImages.reviews.avatars.slice(0, 3).map((src) => (
              <ProductImage key={src} src={src} alt="" width={36} height={36} />
            ))}
          </div>
          <div>
            <strong className="review-bar__title">Crafted to be worn every day</strong>
            <span className="review-bar__sub">IGI certified · BIS hallmarked · Insured delivery</span>
          </div>
        </div>
        <Button href="/all-products/rings" variant="secondary" size="sm">
          Shop the Collection
        </Button>
      </div>
    </div>
  );
}
