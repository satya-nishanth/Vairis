import { FooterAccordion } from "./FooterAccordion";
import Link from "next/link";
import type { FooterVariant } from "@/lib/layout-config";
import { WHATSAPP_URL } from "@/lib/ui-data";
import { BrandLogo } from "./BrandLogo";
import { IconChevronRight, SharedIcon, ThemeIcon } from "@/components/icons/ThemeIcon";
import {
  footerAboutLinks,
  footerHelpLinks,
  footerShopLinks,
  footerSocialLinks,
  footerTrustItems,
} from "@/lib/footer-content";

type SiteFooterProps = {
  variant: FooterVariant;
};

function FooterSocialLinks() {
  return (
    <nav className="site-footer__social" aria-label="Social media">
      {footerSocialLinks.map(({ label, href, icon }) => (
        <Link
          key={label}
          href={href}
          className="site-footer__social-link"
          aria-label={label}
          target="_blank"
          rel="noopener noreferrer"
        >
          <SharedIcon
            name={icon}
            category="social"
            size={18}
            className={`site-footer__social-icon site-footer__social-icon--${icon}`}
          />
        </Link>
      ))}
    </nav>
  );
}

export function SiteFooter({ variant }: SiteFooterProps) {
  if (variant === "full") {
    return (
      <footer className="site-footer">
        <div className="site-footer__top">
          <div className="site-footer__top-inner">
            <div className="site-footer__newsletter">
              <h3 className="site-footer__newsletter-title">Be the first to know</h3>
              <p className="site-footer__newsletter-desc">New arrivals, exclusive offers and styling tips.</p>
              <form className="newsletter-form" action="#" method="post">
                <input type="email" placeholder="Enter your email" aria-label="Email address" />
                <button type="submit" aria-label="Subscribe to newsletter">
                  <IconChevronRight />
                </button>
              </form>
            </div>
            <ul className="site-footer__trust-grid" aria-label="Shopping guarantees">
              {footerTrustItems.map(({ label, icon }) => (
                <li key={label} className="site-footer__trust-item">
                  <ThemeIcon name={icon.name} category={icon.category} size={28} className="site-footer__trust-icon" />
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="site-footer__main">
          <div className="site-footer__main-inner">
            <div className="site-footer__col site-footer__col--brand">
              <Link href="/" className="logo logo--image">
                <BrandLogo className="logo__img site-footer__logo" width={160} height={52} />
              </Link>
              <FooterSocialLinks />
            </div>

            <div className="site-footer__cols-desktop">
            <div className="site-footer__col">
              <h4>Shop</h4>
              {footerShopLinks.map(({ label, href }) => (
                <Link key={label} href={href}>
                  {label}
                </Link>
              ))}
            </div>

            <div className="site-footer__col">
              <h4>Help</h4>
              {footerHelpLinks.map(({ label, href }) => (
                <Link key={label} href={href}>
                  {label}
                </Link>
              ))}
            </div>

            <div className="site-footer__col">
              <h4>About</h4>
              {footerAboutLinks.map(({ label, href }) => (
                <Link key={label} href={href}>
                  {label}
                </Link>
              ))}
            </div>
            </div>

            <FooterAccordion
              className="site-footer__cols-mobile"
              sections={[
                { title: "Shop", links: footerShopLinks },
                { title: "Help", links: footerHelpLinks },
                { title: "About", links: footerAboutLinks },
              ]}
            />

            <aside className="site-footer__help-box">
              <div className="site-footer__help-inner">
                <h4 className="site-footer__help-title">Need help?</h4>
                <div className="site-footer__help-icons">
                <Link
                  href={WHATSAPP_URL}
                  className="site-footer__help-icon-link"
                  aria-label="Chat on WhatsApp"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <SharedIcon name="whatsapp_logo" category="social" size={20} />
                </Link>
                <Link href="mailto:hello@vairis.com" className="site-footer__help-icon-link" aria-label="Email us">
                  <ThemeIcon name="email_envelope" category="social" size={20} />
                </Link>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <div className="site-footer__bottom">
          <div className="site-footer__bottom-inner">
            <span>© 2026 VAIRIS. All rights reserved.</span>
            <span className="site-footer__legal">
              <Link href="#">Privacy Policy</Link>
              <span aria-hidden> · </span>
              <Link href="#">Terms &amp; Conditions</Link>
            </span>
          </div>
        </div>
      </footer>
    );
  }

  if (variant === "compact") {
    return (
      <footer className="site-footer">
        <div className="site-footer__main">
          <div className="site-footer__main-inner site-footer__main-inner--compact">
            <div className="site-footer__col site-footer__col--brand">
              <Link href="/" className="logo logo--image">
                <BrandLogo className="logo__img site-footer__logo" width={140} height={48} />
              </Link>
              <FooterSocialLinks />
            </div>
            <div className="site-footer__col">
              <h4>Shop</h4>
              <Link href={footerShopLinks[0].href}>Necklaces</Link>
            </div>
            <div className="site-footer__col">
              <h4>Help</h4>
              <Link href="/returns">Returns</Link>
              <Link href="/contact">Contact</Link>
            </div>
            <div className="site-footer__col">
              <h4>Contact</h4>
              <Link href={WHATSAPP_URL}>WhatsApp</Link>
            </div>
          </div>
        </div>
        <div className="site-footer__bottom">
          <div className="site-footer__bottom-inner">
            <span>© 2026 VAIRIS</span>
            <Link href="#">Privacy</Link>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="site-footer">
      <div className="site-footer__bottom">
        <div className="site-footer__bottom-inner site-footer__bottom-inner--minimal">
          <span>© 2026 VAIRIS</span>
          <Link href="/">Continue shopping</Link>
        </div>
      </div>
    </footer>
  );
}
