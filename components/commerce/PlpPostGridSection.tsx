import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/Section";
import { Rating } from "@/components/ui/Rating";
import { ProductImage } from "@/components/ui/ProductImage";
import { CommerceTrustHelpPanel } from "@/components/commerce/CommerceTrustHelpPanel";
import { lifestyleScenes } from "@/lib/ui-data";
import { marketingImages } from "@/lib/images";

export function PlpPostGridSection() {
  return (
    <div className="plp-post-grid">
      <SectionHeader title="Real Women. Real Everyday Style." actionLabel="View All →" actionHref="#" />

      <div className="ugc-row">
        {lifestyleScenes.map((scene) => (
          <div key={scene.id} className="ugc-item">
            <ProductImage src={scene.image} alt={scene.label} width={500} height={500} />
            <span>{scene.ugcLabel}</span>
          </div>
        ))}
      </div>

      <CommerceTrustHelpPanel />

      <div className="review-bar">
        <div className="review-bar__content">
          <div className="review-bar__avatars">
            {marketingImages.reviews.avatars.slice(0, 3).map((src) => (
              <ProductImage key={src} src={src} alt="" width={36} height={36} />
            ))}
          </div>
          <div>
            <strong className="review-bar__title">Loved by 10,000+ women</strong>
            <Rating score="4.9" reviews="2,500+ reviews" />
          </div>
        </div>
        <Button href="#" variant="secondary" size="sm">
          Read Real Reviews
        </Button>
      </div>
    </div>
  );
}
