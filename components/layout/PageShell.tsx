import type { PageLayoutConfig } from "@/lib/layout-config";
import type { BreadcrumbItem } from "@/components/ui/Breadcrumbs";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PromoBar } from "./PromoBar";
import { CheckoutHeader, SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { TrustBar } from "./TrustBar";
import { ContactUsFab } from "./ContactUsFab";

type PageShellProps = PageLayoutConfig & {
  children: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
};

export function PageShell({
  promoBar,
  header,
  trustBar,
  footer,
  whatsapp,
  breadcrumbs,
  children,
}: PageShellProps) {
  return (
    <>
      {promoBar !== "none" && <PromoBar variant={promoBar} />}
      {header === "checkout" ? (
        <CheckoutHeader />
      ) : (
        <SiteHeader variant={header} />
      )}
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      {trustBar !== "none" && <TrustBar variant={trustBar} />}
      {children}
      <SiteFooter variant={footer} />
      {whatsapp && <ContactUsFab label={typeof whatsapp === "string" ? whatsapp : undefined} />}
    </>
  );
}
