import Link from "next/link";
import { IconChevronRight, SharedIcon, ThemeIcon } from "@/components/icons/ThemeIcon";
import { plpHelpLinks, plpTrustItemsPrimary, plpTrustItemsSecondary } from "@/lib/plp-content";

type TrustCardProps = {
  icon: { name: string; category: "brand" };
  label: string;
  description: string;
};

function TrustCard({ icon, label, description }: TrustCardProps) {
  return (
    <article className="plp-trust-card">
      <span className="plp-trust-card__icon-wrap">
        <ThemeIcon name={icon.name} category={icon.category} size={36} className="plp-trust-card__icon" />
      </span>
      <h4 className="plp-trust-card__title">{label}</h4>
      <p className="plp-trust-card__desc">{description}</p>
    </article>
  );
}

/** Shared trust + help panel used on PLP and PDP. */
export function CommerceTrustHelpPanel({ className }: { className?: string }) {
  return (
    <div className={["plp-bottom", className].filter(Boolean).join(" ")}>
      <div className="plp-bottom__trust" aria-label="Shopping guarantees">
        <div className="plp-trust-cards">
          <div className="plp-trust-cards__row plp-trust-cards__row--four">
            {plpTrustItemsPrimary.map((item) => (
              <TrustCard key={item.label} {...item} />
            ))}
          </div>
          <div className="plp-trust-cards__row plp-trust-cards__row--three">
            {plpTrustItemsSecondary.map((item) => (
              <TrustCard key={item.label} {...item} />
            ))}
          </div>
        </div>
      </div>

      <aside className="help-panel">
        <h3 className="help-panel__title">Need help choosing?</h3>
        <p className="help-panel__lead">Our diamond experts are here for you.</p>
        <hr className="help-panel__divider" />
        <ul className="help-panel__links">
          {plpHelpLinks.map(({ title, subtext, href, icon }) => (
            <li key={title}>
              <Link href={href} className="help-panel__link">
                <span className="help-panel__link-main">
                  {"shared" in icon && icon.shared ? (
                    <SharedIcon name={icon.name} category={icon.category} size={24} className="help-panel__link-icon" />
                  ) : (
                    <ThemeIcon
                      name={icon.name}
                      category={icon.category}
                      size={24}
                      className="help-panel__link-icon help-panel__link-icon--theme"
                    />
                  )}
                  <span className="help-panel__link-text">
                    <strong className="help-panel__link-title">{title}</strong>
                    <span className="help-panel__link-sub">{subtext}</span>
                  </span>
                </span>
                <IconChevronRight className="help-panel__chevron" />
              </Link>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
