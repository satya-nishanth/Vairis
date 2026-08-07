import { MarketingImage } from "@/components/ui/MarketingImage";
import { marketingImages } from "@/lib/images";

export function WhyVairisLandingImage() {
  return (
    <div className="why-vairis__media">
      <MarketingImage
        src={marketingImages.whyVairis}
        alt="VAIRIS jewellery box with necklace"
        width={1308}
        height={884}
        className="why-vairis__img"
        priority
      />
    </div>
  );
}
