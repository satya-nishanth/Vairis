import { SharedIcon } from "@/components/icons/ThemeIcon";
import { MarketingImage } from "@/components/ui/MarketingImage";
import { ProductImage } from "@/components/ui/ProductImage";

type Testimonial = {
  quote: string;
  name: string;
  city: string;
  avatar: string;
};

export function TestimonialCard({ quote, name, city }: Testimonial) {
  return (
    <article className="testimonial-card">
      <div className="testimonial-card__stars" aria-label="5 out of 5 stars">
        {Array.from({ length: 5 }, (_, i) => (
          <SharedIcon key={i} name="star_rating_filled" category="content" size={14} />
        ))}
      </div>
      <p className="testimonial-card__quote">&ldquo;{quote}&rdquo;</p>
      <div className="testimonial-card__author">
        <div
          className="testimonial-card__avatar"
          aria-hidden="true"
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "var(--color-surface-subtle, rgba(201, 169, 110, 0.12))",
            color: "var(--color-primary, #c9a96e)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 600,
            fontSize: "0.9375rem",
            border: "1px solid var(--color-border-light, rgba(201, 169, 110, 0.3))",
            flexShrink: 0,
          }}
        >
          {name.charAt(0)}
        </div>
        <div>
          <strong className="testimonial-card__name">{name}</strong>
          <span className="testimonial-card__city">{city}</span>
        </div>
      </div>
    </article>
  );
}

export function StaffAvatars({ size = 36 }: { images?: readonly string[]; size?: number }) {
  const consultants = ["PS", "AK", "NM", "RD"];
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {consultants.map((initials, i) => (
        <div
          key={initials}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            marginLeft: i > 0 ? -8 : 0,
            border: "2px solid var(--bg-card)",
            background: "var(--color-surface-subtle, #f8f5f0)",
            color: "var(--color-primary, #c9a96e)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.75rem",
            fontWeight: 600,
          }}
          aria-hidden="true"
        >
          {initials}
        </div>
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
