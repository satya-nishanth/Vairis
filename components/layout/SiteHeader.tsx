import Link from "next/link";
import type { HeaderVariant } from "@/lib/layout-config";
import { CATEGORY_LABELS, categoryHref, HEADER_NAV_CATEGORIES } from "@/lib/catalogue-ui";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { BrandLogo } from "./BrandLogo";
import { HeaderPincode } from "./HeaderPincode";
import { HeaderAccountButton } from "./HeaderAccountButton";
import { HeaderWishlistLink } from "./HeaderWishlistLink";
import { HeaderSearchButton } from "./HeaderSearchButton";
import { SiteHeaderMobileToggle } from "./SiteHeaderMobileToggle";
import { HeaderCartLink } from "./HeaderCartLink";
import { NavCollections } from "./NavCollections";
import { NavCategoryLinks } from "./NavCategoryLinks";

type SiteHeaderProps = {
  variant: Exclude<HeaderVariant, "checkout">;
};

const categoryNavLinks = HEADER_NAV_CATEGORIES.map((slug) => ({
  href: categoryHref(slug),
  label: CATEGORY_LABELS[slug].title,
}));

const navLinks = [
  ...categoryNavLinks,
  { href: "/collections/mangalsutra", label: "Mangalsutra" },
  { href: "/about", label: "About Us" },
];

const minimalNavLinks = [
  { href: categoryHref("rings"), label: "Shop" },
  { href: "/collections/mangalsutra", label: "Mangalsutra" },
  { href: "/about", label: "About Us" },
];

export function SiteHeader({ variant }: SiteHeaderProps) {
  const links = variant === "minimal" ? minimalNavLinks : navLinks;
  const showAccount = variant === "full" || variant === "standard";
  const showPincode = variant === "full" || variant === "standard";

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <div className="site-header__start">
          <SiteHeaderMobileToggle links={links} showPincode={showPincode} showTheme />
          <Link href="/" className="site-header__brand logo logo--image" aria-label="VAIRIS home">
            <BrandLogo className="site-header__brand-img" priority />
          </Link>
        </div>

        {showPincode && <HeaderPincode className="header-pincode--desktop" />}

        <nav className="site-header__nav nav-main" aria-label="Main">
          {variant === "minimal" ? (
            minimalNavLinks.map((link) => (
              <Link key={`${link.href}-${link.label}`} href={link.href}>
                {link.label}
              </Link>
            ))
          ) : (
            <>
              <NavCategoryLinks />
              <Link href="/about">About Us</Link>
              <NavCollections />
            </>
          )}
        </nav>

        <div className="site-header__utilities">
          <HeaderSearchButton />
          <ThemeSwitcher className="theme-switcher--desktop" />
          <ThemeSwitcher className="theme-switcher--mobile" />
          <div className="header-actions">
            {showAccount && <HeaderAccountButton />}
            <HeaderWishlistLink />
            <HeaderCartLink />
          </div>
        </div>
      </div>
    </header>
  );
}

export function CheckoutHeader() {
  return (
    <header className="checkout-header">
      <Link href="/" className="logo logo--image">
        <BrandLogo />
      </Link>
      <p className="checkout-header__secure">🔒 Secure Checkout</p>
      <p style={{ fontSize: "0.8125rem" }}>Your data and payment are 100% secure.</p>
      <div className="checkout-header__badges">
        <span>Powered by Razorpay</span>
        <span>SSL Secured</span>
        <span>100% Insured Delivery</span>
      </div>
    </header>
  );
}
