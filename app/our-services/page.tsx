import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { ThemeIcon } from "@/components/icons/ThemeIcon";
import { pageLayouts } from "@/lib/layout-config";

export const metadata: Metadata = {
  title: "Our Services & Promises | VAIRIS",
  description:
    "Explore VAIRIS services: certified diamonds, BIS hallmarked gold, insured jewellery delivery, secure payments, easy returns, and personal support.",
};

const serviceSections = [
  {
    id: "diamond-certification",
    number: "01",
    icon: "igi_certified",
    eyebrow: "Independent diamond documentation",
    title: "IGI-certified diamonds",
    description:
      "Our diamond pieces come with an IGI grading report that describes the individual stone. Learn how the 4Cs work and how to match a report to the diamond you are considering.",
    link: "/diamond-certification#read-your-report",
    linkLabel: "Learn how to read a diamond report",
  },
  {
    id: "gold-hallmarking",
    number: "02",
    icon: "bis_hallmark",
    eyebrow: "Gold purity you can check",
    title: "BIS-hallmarked gold",
    description:
      "Our gold jewellery is BIS hallmarked. The hallmark identifies the stated fineness, while its HUID gives each hallmarked article a unique identity you can verify.",
    link: "/diamond-certification#gold-hallmarking",
    linkLabel: "Understand gold hallmarks and HUID",
  },
  {
    id: "insured-delivery",
    number: "03",
    icon: "insured_shipping",
    eyebrow: "From our hands to yours",
    title: "Insured jewellery delivery",
    description:
      "We work with specialist partners focused on jewellery deliveries. Your shipment is insured in transit, packed in tamper-evident packaging, and handed over with OTP protection for a more reassuring delivery experience.",
    link: "/policies/shipping",
    linkLabel: "See shipping, insurance, and delivery details",
  },
  {
    id: "secure-payments",
    number: "04",
    icon: "secure_payments",
    eyebrow: "Flexible payments, handled carefully",
    title: "Secure payments & automatic refunds",
    description:
      "We work with leading payment gateways such as Razorpay. Available methods can include UPI, cards, netbanking, and EMI options, depending on the order and provider eligibility. Once a refund is approved, it is automatically initiated through the payment gateway; your bank or card issuer may take 5–7 business days to show the credit. VAIRIS does not store your card or UPI credentials.",
    link: "/policies/refund",
    linkLabel: "Read our refund policy",
  },
  {
    id: "returns-exchange",
    number: "05",
    icon: "easy_returns",
    eyebrow: "A little more confidence after checkout",
    title: "Returns & exchange, made clear",
    description:
      "Eligible pieces can be requested for return within 15 days of delivery. If you choose another VAIRIS piece, eligible items currently receive 90% exchange value under the stated policy.",
    link: "/returns",
    linkLabel: "Explore the returns and exchange guide",
  },
  {
    id: "lifetime-support",
    number: "06",
    icon: "lifetime_support",
    eyebrow: "People to help along the way",
    title: "Lifetime support",
    description:
      "Questions about choosing, fit, delivery, care, or what comes next? Our team is here to help before and after your purchase. Every product purchased from VAIRIS also comes with lifetime free repairs.",
    link: "/contact",
    linkLabel: "Talk to the VAIRIS team",
  },
  {
    id: "dna-diamond",
    number: "07",
    icon: null,
    eyebrow: "A story made personal",
    title: "DNA Diamond keepsakes",
    description:
      "A personal sample can become a diamond keepsake through a traceable process. The finished diamond is grown from purified carbon derived from the submitted sample—not from intact DNA strands.",
    link: "/dna-diamond",
    linkLabel: "Explore the DNA Diamond journey",
  },
  {
    id: "diamond-pricing",
    number: "08",
    icon: null,
    eyebrow: "Choose what matters to you",
    title: "With-exchange or lower upfront pricing",
    description:
      "On eligible diamond jewellery, choose the with-exchange option or a lower upfront price without the future full-value diamond exchange benefit. The difference is around 30% on eligible pieces; compare the actual prices and terms shown on each product.",
    link: "/why-vairis#the-choice",
    linkLabel: "See how the two pricing choices work",
  },
  {
    id: "vairis-way",
    number: "09",
    icon: null,
    eyebrow: "An online-led way to shop",
    title: "Clear details, online and in person",
    description:
      "We focus on online discovery and experience centres, bringing attention to the jewellery, its documented quality, and clear product pricing—with people available when you want guidance.",
    link: "/why-vairis#our-approach",
    linkLabel: "Discover the VAIRIS approach",
  },
] as const;

export default function OurServicesPage() {
  return (
    <PageShell
      {...pageLayouts.contact}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Our Services" },
      ]}
    >
      <main className="services-page">
        <Container>
          <header className="services-hero" id="service-overview">
            <p className="services-eyebrow">The details behind a more reassuring purchase</p>
            <h1>Good jewellery. Clear promises. Help when you need it.</h1>
            <p>Explore the services that support your VAIRIS experience—from understanding a diamond report to receiving your jewellery safely and getting help after it arrives.</p>
            <nav className="services-quick-links" aria-label="Jump to a VAIRIS service">
              {serviceSections.map((service) => (
                <a key={service.id} href={`#${service.id}`}>{service.title}</a>
              ))}
            </nav>
          </header>

          <div className="services-grid">
            {serviceSections.map((service) => (
              <section className="service-card" id={service.id} key={service.id} aria-labelledby={`${service.id}-title`}>
                <div className="service-card__top">
                  <span className="service-card__number">{service.number}</span>
                  {service.icon && (
                    <ThemeIcon name={service.icon} category="brand" size={32} className="service-card__icon" />
                  )}
                </div>
                <p className="services-eyebrow">{service.eyebrow}</p>
                <h2 id={`${service.id}-title`}>{service.title}</h2>
                <p className="service-card__description">{service.description}</p>
                <Link className="service-card__link" href={service.link}>
                  {service.linkLabel} <span aria-hidden>→</span>
                </Link>
              </section>
            ))}
          </div>

          <section className="services-contact">
            <div><p className="services-eyebrow">Still deciding?</p><h2>We can talk it through.</h2><p>Reach out if you would like a person to walk you through any of these services.</p></div>
            <Link href="/contact">Contact VAIRIS <span aria-hidden>→</span></Link>
          </section>
        </Container>
      </main>
    </PageShell>
  );
}
