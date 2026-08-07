import type { TrustBarVariant } from "@/lib/layout-config";
import { ThemeIcon } from "@/components/icons/ThemeIcon";
import { TRUST_ITEMS_COMPACT } from "@/components/icons";
import { trustBarItems } from "@/lib/trust-content";

type TrustBarProps = {
  variant: Exclude<TrustBarVariant, "none">;
  className?: string;
  style?: React.CSSProperties;
};

export function TrustBar({ variant, className, style }: TrustBarProps) {
  if (variant === "full") {
    return (
      <div className={["trust-bar", className].filter(Boolean).join(" ")} style={style}>
        <div className="trust-bar__inner">
          {trustBarItems.map(({ label, icon }) => (
            <div key={label} className="trust-bar__item">
              <ThemeIcon name={icon.name} category={icon.category} size={32} className="trust-bar__icon" />
              <span className="trust-bar__label">{label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={["trust-bar", className].filter(Boolean).join(" ")} style={style}>
      <div className="trust-bar__inner">
        {TRUST_ITEMS_COMPACT.map((label) => (
          <div key={label} className="trust-bar__item trust-bar__item--text">
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
