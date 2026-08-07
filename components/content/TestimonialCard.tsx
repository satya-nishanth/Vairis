import { SharedIcon } from "@/components/icons/ThemeIcon";
import { MarketingImage } from "@/components/ui/MarketingImage";
import { ProductImage } from "@/components/ui/ProductImage";

type Testimonial = {
  quote: string;
  name: string;
  city: string;
  avatar: string;
};

export function TestimonialCard({ quote, name, city, avatar }: Testimonial) {
  return (
    <article className="testimonial-card">
      <div className="testimonial-card__stars" aria-label="5 out of 5 stars">
        {Array.from({ length: 5 }, (_, i) => (
          <SharedIcon key={i} name="star_rating_filled" category="content" size={14} />
        ))}
      </div>
      <p className="testimonial-card__quote">&ldquo;{quote}&rdquo;</p>
      <div className="testimonial-card__author">
        <MarketingImage
          src={avatar}
          alt={name}
          width={40}
          height={40}
          className="testimonial-card__avatar"
          placeholderLabel={name.charAt(0)}
        />
        <div>
          <strong className="testimonial-card__name">{name}</strong>
          <span className="testimonial-card__city">{city}</span>
        </div>
      </div>
    </article>
  );
}

export function StaffAvatars({ images, size = 40 }: { images: readonly string[]; size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {images.map((src, i) => (
        <ProductImage
          key={src}
          src={src}
          alt=""
          width={size}
          height={size}
          style={{ borderRadius: "50%", marginLeft: i > 0 ? -8 : 0, border: "2px solid var(--bg-card)" }}
        />
      ))}
    </div>
  );
}

type HelpBlockProps = {
  title: string;
  description?: string;
  href: string;
  cta?: string;
  variant?: "card" | "tile" | "inline";
};

export function HelpBlock({ title, description, href, cta, variant = "card" }: HelpBlockProps) {
  if (variant === "tile") {
    return (
      <a href={href} className="help-card">
        <strong>{title}</strong>
      </a>
    );
  }

  if (variant === "inline") {
    return (
      <a href={href} style={{ display: "flex", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
        {title} →
      </a>
    );
  }

  return (
    <article className="help-card-large">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      <a href={href} className="btn-ghost">
        {cta ?? "Learn more →"}
      </a>
    </article>
  );
}
