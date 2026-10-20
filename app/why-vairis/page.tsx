import type { Metadata } from "next";
import Image from "next/image";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { TrustBar } from "@/components/layout/TrustBar";
import { WHATSAPP_URL } from "@/lib/ui-data";
import { pageLayouts } from "@/lib/layout-config";

export const metadata: Metadata = {
  title: "Why VAIRIS? Jewellery, Your Way",
  description:
    "Most people keep the jewellery they love. Learn how VAIRIS lets you choose a lower upfront diamond price without exchange, or a with-exchange option, with clear quality and pricing.",
};

const frictions = [
  ["01", "A lot of retail cost sits behind the counter.", "Luxury storefronts, large inventories, high-reach marketing, and the teams needed to run them all add operating costs."],
  ["02", "Those costs can be hard to see in the price.", "Customers deserve to understand what goes into the jewellery itself—not just pay one number shaped by a retail model they cannot see."],
  ["03", "Quality should be easy to understand.", "Diamond details, gold purity, and the way a piece is priced should be clear before you decide, whether you shop online or in person."],
];

const responses = [
  ["Two ways to buy", "Choose the diamond price with a future exchange benefit, or choose a lower upfront price without that benefit."],
  ["An online-led model", "We focus on online shopping, supported by experience centres where you can get closer to the pieces."],
  ["Quality you can check", "Explore diamond grading reports and BIS-hallmarked gold, with simple guides to help explain what they mean."],
  ["People when you need them", "Get help with choosing, sizing, delivery, returns, and care from our team."],
];

export default function WhyVairisPage() {
  return (
    <PageShell
      {...pageLayouts.contact}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Why VAIRIS" },
      ]}
    >
      <main className="why-page">
        <Container>
          <section className="why-hero">
            <div className="why-hero__copy">
              <p className="why-eyebrow">A different way to think about jewellery</p>
              <h1>How many times do you actually exchange the jewellery you love?</h1>
              <p>Most of us keep the pieces and gifts that mean something to us. So why should every diamond purchase make you pay for an exchange you may never use? At VAIRIS, you choose the option that feels right.</p>
              <div className="why-hero__actions">
                <Button href="/all-products/rings" variant="primary">See your two choices</Button>
                <a href="#the-choice">How it works <span aria-hidden>↓</span></a>
              </div>
            </div>
            <div className="why-hero__visual">
              <Image src="/images/why-vairis-hero.png" alt="A couple sharing a meaningful jewellery gift moment" width={1672} height={941} priority />
              <span className="why-hero__caption">Made to mean something. Chosen your way.</span>
            </div>
          </section>

          <section className="why-choice" id="the-choice" aria-labelledby="why-choice-title">
            <div className="why-section-heading">
              <p className="why-eyebrow">A choice built around real life</p>
              <h2 id="why-choice-title">Keep the exchange option—or keep more in your pocket today.</h2>
              <p>On eligible diamond jewellery, choose the pricing that matches how you expect to use your piece.</p>
            </div>
            <div className="why-choice__grid">
              <article className="why-choice-card why-choice-card--saving">
                <span className="why-choice-card__tag">LOWER UPFRONT PRICE</span>
                <h3>Without exchange</h3>
                <p>Prefer to buy your diamond and keep it? Choose the lower upfront price—around 30% less on eligible pieces, as shown in the product pricing.</p>
                <small>This option does not include the future full-value diamond exchange benefit.</small>
              </article>
              <article className="why-choice-card">
                <span className="why-choice-card__tag">FUTURE EXCHANGE BENEFIT</span>
                <h3>With exchange</h3>
                <p>Choose the with-exchange price if you value the option to exchange your eligible diamond later under the applicable product terms.</p>
                <small>Compare both prices and the item-specific terms on the product page before choosing.</small>
              </article>
            </div>
            <p className="why-choice__note">The price difference applies to diamond pricing and can vary by piece. The available options and exchange terms are shown with each eligible product.</p>
          </section>

          <section className="why-frictions" aria-labelledby="why-frictions-title">
            <div className="why-section-heading">
              <p className="why-eyebrow">The problem with the traditional model</p>
              <h2 id="why-frictions-title">Beautiful jewellery shouldn&apos;t come with a mystery markup.</h2>
              <p>Across the industry, the cost of running a large retail footprint can be substantial. We believe shoppers should be able to see the value in the piece—not just the cost of the system around it.</p>
            </div>
            <div className="why-frictions__grid">
              {frictions.map(([number, title, description]) => (
                <article className="why-friction" key={number}>
                  <span>{number}</span><h3>{title}</h3><p>{description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="why-experience" aria-labelledby="why-experience-title">
            <div className="why-experience__visual">
              <Image src="/images/why-vairis-experience.png" alt="A jewellery advisor helping a customer examine a ring and its details" width={1536} height={1024} />
            </div>
            <div className="why-experience__copy">
              <p className="why-eyebrow">Online when it suits you. In person when you want.</p>
              <h2 id="why-experience-title">A clearer choice, with real people nearby.</h2>
              <p>Explore the collection and compare the details online at your own pace. If you would like to see a piece more closely, our experience centres let you talk it through with our team and make the choice with confidence.</p>
              <a href={WHATSAPP_URL}>Ask our team about an experience centre <span aria-hidden>→</span></a>
            </div>
          </section>

          <section className="why-approach" id="our-approach" aria-labelledby="why-approach-title">
            <div className="why-section-heading">
              <p className="why-eyebrow">Our answer</p>
              <h2 id="why-approach-title">World-class quality. A more considered way to shop.</h2>
              <p>VAIRIS is built around online-first discovery and experience centres: less dependence on a network of luxury storefronts, more focus on the jewellery, its quality, and helping you choose with confidence.</p>
            </div>
            <div className="why-approach__grid">
              {responses.map(([title, description], index) => (
                <article className="why-approach-card" key={title}>
                  <span className="why-approach-card__mark">0{index + 1}</span>
                  <h3>{title}</h3><p>{description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="why-price" aria-label="Transparent price breakup">
            <div>
              <p className="why-eyebrow">No guesswork about quality or cost</p>
              <h2>See what your jewellery is made of.</h2>
              <p>We pair carefully selected diamonds with grading documentation and BIS-hallmarked gold. Product details show the components behind the price, so you can understand the gold, diamond, making charges, and applicable taxes.</p>
            </div>
            <div className="why-price__list">
              {["Gold · purity and weight", "Diamond · grade and carat details", "Making charges", "Applicable taxes"].map((line, index) => (
                <div key={line}><span>{line}</span><b>{String(index + 1).padStart(2, "0")}</b></div>
              ))}
            </div>
          </section>

          <section className="why-proof">
            <p className="why-eyebrow">Confidence, backed by details</p>
            <h2>Quality you can learn about.</h2>
            <div className="why-proof__links">
              <a href="/diamond-certification"><span>01</span><b>Diamond grading reports</b><i>Understand the 4Cs and verify a report →</i></a>
              <a href="/returns"><span>02</span><b>Returns &amp; exchange</b><i>See the process and how to get help →</i></a>
              <a href="/dna-diamond"><span>03</span><b>Personal stories, made tangible</b><i>Discover the DNA Diamond journey →</i></a>
            </div>
          </section>

          <section className="why-cta">
            <div><p className="why-eyebrow">A piece for your everyday</p><h2>Find the one that feels like you.</h2></div>
            <div className="why-cta__actions"><Button href="/all-products/rings" variant="primary">Explore jewellery</Button><Button href={WHATSAPP_URL} variant="secondary">Talk to our team</Button></div>
          </section>
          <TrustBar variant="compact" style={{ margin: "48px 0 0" }} />
        </Container>
      </main>
    </PageShell>
  );
}
