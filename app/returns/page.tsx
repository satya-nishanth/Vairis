import type { Metadata } from "next";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Accordion } from "@/components/ui/Accordion";
import { ProductImage } from "@/components/ui/ProductImage";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { pageLayouts } from "@/lib/layout-config";
import { WHATSAPP_URL } from "@/lib/ui-data";
import { marketingImages } from "@/lib/images";

export const metadata: Metadata = {
  title: "Returns & Exchanges — 15-Day Returns",
  description:
    "Understand the fine print in jewellery return policies, then see how VAIRIS makes eligible returns and exchanges simple with 15-day returns and 90% exchange value.",
};

const darkPractices = [
  ["Does the headline match the policy?", "A bold “easy returns” promise can feel different when important conditions only appear deep in the policy. Check the full terms before you buy.", "THE PROMISE"],
  ["Is exchange being confused with a refund?", "Store credit or an exchange is not the same as money returned to your original payment method. Look for both options separately.", "YOUR OPTIONS"],
  ["100% of exactly what?", "Ask whether a percentage applies to the full invoice, only the metal, or only the diamond—and what happens to making charges, taxes, and discounts.", "THE MATH"],
  ["Can you follow the value calculation?", "Vague or changing valuation rules make it difficult to estimate what your piece is worth before you commit.", "THE MATH"],
  ["Are there extra fees later?", "Pickup, shipping, inspection, or processing costs should be easy to find before you place an order—not a surprise later.", "THE COSTS"],
  ["Does exchange credit expire?", "Check whether credit can be split across purchases, expires, or requires you to spend above a minimum.", "YOUR OPTIONS"],
  ["When does the return clock start?", "Find out when the return window begins, how long it lasts, and how to make a request within it.", "THE TIMING"],
  ["Which pieces are excluded?", "Coins, customised pieces, engraved jewellery, or sale items may have different rules. Look for exclusions up front.", "THE CONDITIONS"],
  ["What paperwork must you keep?", "Know which invoice, certificate, tags, or packaging you need—and ask what to do if something is missing.", "THE CONDITIONS"],
  ["Who checks the item, and what happens next?", "A quality check can protect both sides, but the condition standards and next steps should be explained clearly if there is a concern.", "THE PROCESS"],
];

export default function ReturnsPage() {
  return (
    <PageShell
      {...pageLayouts.returns}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Returns & Exchanges" },
      ]}
    >
      <main className="returns-page">
        <Container>
          <section className="returns-hero">
            <div className="returns-hero__copy">
              <p className="returns-eyebrow">A little more confidence after checkout</p>
              <h1>Jewellery should feel good to buy—and easy to return.</h1>
              <p>Clear terms, kind humans, and no awkward interrogation. If your piece isn&apos;t right for you, we&apos;ll help you understand your options.</p>
              <div className="returns-promises">
                <div><strong>15 days</strong><span>to request an eligible return</span></div>
                <div><strong>90%</strong><span>exchange value on eligible pieces</span></div>
              </div>
              <div className="returns-hero__actions">
                <Button href={WHATSAPP_URL} variant="primary">Talk to our team</Button>
                <a href="#our-promise">See how it works <span aria-hidden>↓</span></a>
              </div>
            </div>
            <div className="returns-hero__visual">
              <ProductImage src={marketingImages.returns.heroOpen} alt="A jewellery box opened carefully for inspection" width={800} height={800} />
              <span className="returns-hero__stamp">Your choice<br />matters</span>
            </div>
          </section>

          <section className="returns-watch" aria-labelledby="returns-watch-title">
            <div className="returns-section-heading">
              <p className="returns-eyebrow">A shopper&apos;s checklist</p>
              <h2 id="returns-watch-title">A clear promise should stand up to 10 simple questions.</h2>
              <p>Jewellery policies vary. Keep this little checklist handy and compare the headline with the details before you buy.</p>
            </div>
            <div className="returns-watch__grid">
              {darkPractices.map(([title, description, category], index) => (
                <article className="returns-watch-card" key={title}>
                  <span className="returns-watch-card__number">{String(index + 1).padStart(2, "0")}</span>
                  <div className="returns-watch-card__content">
                    <span className="returns-watch-card__category">{category}</span>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="returns-promise" id="our-promise" aria-labelledby="returns-promise-title">
            <div className="returns-section-heading">
              <p className="returns-eyebrow">The VAIRIS promise</p>
              <h2 id="returns-promise-title">A straightforward way to change your mind.</h2>
              <p>For eligible pieces, you can request a return within 15 days of delivery or choose an exchange with 90% exchange value toward another VAIRIS piece.</p>
            </div>
            <div className="returns-options">
              <article className="returns-option">
                <div className="returns-option__icon" aria-hidden>↩</div>
                <p className="returns-eyebrow">Rather have your money back?</p>
                <h3>15-day returns</h3>
                <p>Contact us within 15 days of delivery. Once the eligible piece passes a simple condition check, we initiate your refund to the original payment method.</p>
                <a href="/policies/refund">Read the return terms <span aria-hidden>→</span></a>
              </article>
              <article className="returns-option returns-option--accent">
                <div className="returns-option__icon" aria-hidden>◇</div>
                <p className="returns-eyebrow">Found another piece you love?</p>
                <h3>90% exchange value</h3>
                <p>Choose another VAIRIS piece and receive 90% exchange value for your eligible original piece, applied toward your new choice.</p>
                <a href={WHATSAPP_URL}>Ask us about an exchange <span aria-hidden>→</span></a>
              </article>
            </div>
            <p className="returns-promise__fineprint">“No questions asked” means we won&apos;t make you justify your choice. Eligibility still matters: the piece must be unworn and returned with its original packaging and certificates. Engraved and made-to-order pieces are final sale. See the full terms for details.</p>
          </section>

          <section className="returns-steps-section" aria-labelledby="returns-steps-title">
            <div className="returns-section-heading">
              <p className="returns-eyebrow">Simple from the first message</p>
              <h2 id="returns-steps-title">Here&apos;s what happens next.</h2>
            </div>
            <ol className="returns-steps">
              {[
                ["Tell us what you prefer", "Message our team with your order number within 15 days of delivery."],
                ["We arrange a secure pickup", "Our team helps coordinate insured reverse pickup for your eligible piece."],
                ["We check the piece together", "We verify the item is unworn and complete with its original packaging and certificates."],
                ["Your choice is completed", "We initiate the eligible refund or help apply your 90% exchange value to a new piece."],
              ].map(([title, description], index) => (
                <li className="returns-step-card" key={title}>
                  <span className="returns-step-card__num">0{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="returns-eligibility">
            <div className="returns-eligibility__visual">
              <ProductImage src={marketingImages.returns.sealed} alt="A gold ring in its jewellery box beside its care card and tag" width={900} height={675} />
            </div>
            <div className="returns-eligibility__copy">
              <p className="returns-eyebrow">A quick checklist</p>
              <h2>Keep these together, just in case.</h2>
              <ul>
                <li>Jewellery is unworn and undamaged.</li>
                <li>Original packaging, tags, and certificates are included.</li>
                <li>Your request is made within 15 days of delivery.</li>
                <li>Engraved and made-to-order pieces are not eligible for return.</li>
              </ul>
              <p>If something arrived damaged or incorrect, please tell us within 48 hours so we can make it right.</p>
              <a href="/policies/refund">Read the full Refund &amp; Return Policy <span aria-hidden>→</span></a>
            </div>
          </section>

          <section className="returns-faq" aria-labelledby="returns-faq-title">
            <h2 id="returns-faq-title">A few things you might be wondering.</h2>
            <Accordion
              className="faq-two-col"
              items={[
                { id: "returns-1", question: "How long do I have to request a return?", answer: "Please contact us within 15 days of delivery. The piece must meet the eligibility conditions in our Refund & Return Policy." },
                { id: "returns-2", question: "What does 90% exchange value mean?", answer: "For an eligible piece, 90% exchange value is applied toward another VAIRIS purchase. Contact our team for the item-specific calculation before you decide." },
                { id: "returns-3", question: "Do I need to explain why I want to return it?", answer: "No. We want you to feel comfortable telling us your choice. We do check that the piece meets the stated return conditions." },
                { id: "returns-4", question: "When will my refund reach me?", answer: "After the eligible item passes verification, we initiate the refund within 2 business days. Your bank may take another 5–7 business days to show it." },
                { id: "returns-5", question: "What if my order arrived damaged or incorrect?", answer: "Please contact us within 48 hours of delivery with photos. We will help with a replacement or a full refund, including shipping." },
                { id: "returns-6", question: "How do I start?", answer: "Message us on WhatsApp with your order number. A real person will help you with the next step." },
              ]}
            />
          </section>

          <section className="returns-cta-band">
            <div className="returns-cta-band__brand">
              <BrandLogo className="returns-cta-band__logo" width={400} height={260} />
            </div>
            <div>
              <p className="returns-eyebrow">We&apos;re here to help</p>
              <h2>Questions? Let&apos;s talk it through.</h2>
              <p>Reach out with your order number and what you&apos;d like to do. We&apos;ll explain the options clearly and help you take it from there.</p>
              <Button href={WHATSAPP_URL} variant="primary">Chat with VAIRIS</Button>
            </div>
          </section>

        </Container>
      </main>
    </PageShell>
  );
}
