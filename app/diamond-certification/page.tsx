import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Accordion } from "@/components/ui/Accordion";
import { pageLayouts } from "@/lib/layout-config";

export const metadata: Metadata = {
  title: "What Makes a Diamond Sparkle—and Gold Pure? A Guide",
  description:
    "Learn diamond grading and the 4Cs, how to verify a grading report, and what a BIS gold hallmark and HUID mean in this simple jewellery guide.",
};

const fourCs = [
  ["01", "Carat · the weight", "Carat tells you how heavy the diamond is, like weighing a little stone on a scale. It does not tell the whole face-up size: shape and measurements matter too."],
  ["02", "Color · the tint", "Color tells you how white or warm a diamond looks. On the usual white-diamond scale, closer to D means less visible tint. Tiny differences can be hard to see once set."],
  ["03", "Clarity · tiny marks", "Clarity is about tiny natural or growth marks. Think of a window with little specks: some marks are easy to see with a magnifier but hard to spot without one."],
  ["04", "Cut · the sparkle-maker", "Cut is how well the diamond's tiny faces are shaped and lined up. Like a mirror, a good cut can send more light back to your eyes, making the diamond look lively."],
];

const marketingGuides = [
  { href: "/diamond-certification", category: "THE 4Cs", title: "What makes a diamond sparkle?", description: "A friendly guide to diamond grades, reports, and choosing what matters to you.", art: "diamond" },
  { href: "/dna-diamond", category: "A PERSONAL STORY", title: "Keep a loved one close", description: "Discover how a personal sample becomes a diamond keepsake, step by step.", art: "heart" },
  { href: "/returns", category: "SHOP WITH CONFIDENCE", title: "Returns, made simple", description: "See how returns and exchanges work, from request to resolution.", art: "parcel" },
  { href: "/why-vairis", category: "THE VAIRIS WAY", title: "Fine jewellery for real life", description: "Learn what we believe makes choosing and wearing fine jewellery feel easier.", art: "sparkle" },
];

function FourCIllustration({ kind }: { kind: string }) {
  if (kind === "01") return <svg viewBox="0 0 120 82" aria-hidden="true"><path d="M60 12 77 29 60 47 43 29 60 12Z"/><path d="M43 29h34M60 47v13M34 63h52M43 63l-8 10m42-10 8 10M60 60v13"/><circle cx="60" cy="12" r="2"/></svg>;
  if (kind === "02") return <svg viewBox="0 0 120 82" aria-hidden="true"><path d="M16 20h88v44H16z"/><path d="M16 20h22v44H16zM38 20h22v44H38zM60 20h22v44H60zM82 20h22v44H82z"/><path d="M16 70h88"/></svg>;
  if (kind === "03") return <svg viewBox="0 0 120 82" aria-hidden="true"><path d="M60 10 78 28 60 48 42 28 60 10Z"/><circle cx="60" cy="29" r="7"/><circle cx="92" cy="52" r="16"/><path d="m103 63 10 10M87 52h10m-5-5v10"/></svg>;
  return <svg viewBox="0 0 120 82" aria-hidden="true"><path d="M36 20h48l12 14-36 38-36-38z"/><path d="M36 20 60 34 84 20M24 34h72M60 34v38M36 20l24 52 24-52M24 34l36 38 36-38"/><path d="M60 5v9m-6-5 6 5 6-5"/></svg>;
}

function GuideArtwork({ kind }: { kind: string }) {
  if (kind === "heart") return <svg viewBox="0 0 240 130" aria-hidden="true"><path d="M120 104 45 45C12 15 55-5 78 20l42 42 42-42c23-25 66-5 33 25z"/><path d="M120 62V24m-13 16h26M38 98h164"/></svg>;
  if (kind === "parcel") return <svg viewBox="0 0 240 130" aria-hidden="true"><path d="m45 44 75-28 75 28-75 29zM45 44v52l75 25V73m75-29v52l-75 25M120 16v57m-75-29 75 29 75-29"/><path d="M94 33l76 29"/></svg>;
  if (kind === "sparkle") return <svg viewBox="0 0 240 130" aria-hidden="true"><path d="m120 13 13 43 43 13-43 13-13 43-13-43-43-13 43-13zM50 20l6 19 19 6-19 6-6 19-6-19-19-6 19-6zM190 72l6 19 19 6-19 6-6 19-6-19-19-6 19-6z"/></svg>;
  return <svg viewBox="0 0 240 130" aria-hidden="true"><path d="M120 14 145 40 120 66 95 40zM95 40h50M120 66v32M88 102h64M96 102l-15 15m63-15 15 15"/><path d="m49 28 6 15 15 6-15 6-6 15-6-15-15-6 15-6zM192 18l6 15 15 6-15 6-6 15-6-15-15-6 15-6z"/></svg>;
}

export default function DiamondCertificationPage() {
  return (
    <PageShell
      {...pageLayouts.contact}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Diamond & Gold Certification" },
      ]}
    >
      <main className="igi-page">
        <Container>
          <section className="igi-hero">
            <div className="igi-hero__copy">
              <p className="igi-eyebrow">A simple guide to diamond and gold quality</p>
              <h1>What makes a diamond sparkle—and how do you know your gold is pure?</h1>
              <p>A diamond report is its fact card; a gold hallmark is its quality mark. Learn what each one tells you, what to look for, and how to check it before you buy.</p>
              <Button href="#read-your-report" variant="primary">Start with the four Cs</Button>
            </div>
            <div className="igi-report-card" aria-label="Illustration of the information found on a diamond grading report">
              <div className="igi-report-card__top"><span>DIAMOND GRADING REPORT</span><span className="igi-report-card__seal">4Cs</span></div>
              <div className="igi-report-card__stone"><span aria-hidden>✦</span><span>Independent grading</span></div>
              <div className="igi-report-card__lines">
                <div><span>IDENTITY</span><i /></div>
                <div><span>ORIGIN</span><i /></div>
                <div><span>CARAT · COLOR · CLARITY · CUT</span><i /></div>
                <div><span>MEASUREMENTS &amp; OTHER DETAILS</span><i /></div>
              </div>
              <p className="igi-report-card__caption">A pretend example · your report describes your individual diamond</p>
            </div>
          </section>

          <section className="igi-intro" id="read-your-report">
            <p className="igi-eyebrow">The four Cs · four clues about a diamond</p>
            <h2>Four little clues. One big picture.</h2>
            <p className="igi-intro__lead">No one number can tell you if a diamond is right for you. Look at the clues together, then decide what you love most.</p>
            <div className="igi-four-cs">
              {fourCs.map(([number, title, text]) => (
                <article className="igi-c-card" key={title}>
                  <span className="igi-c-card__number">{number}</span>
                  <div className="igi-c-card__art"><FourCIllustration kind={number} /></div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="igi-sparkle" aria-labelledby="igi-sparkle-title">
            <div className="igi-sparkle__copy">
              <p className="igi-eyebrow">Why cut can change the look</p>
              <h2 id="igi-sparkle-title">A diamond is a tiny light-bouncer.</h2>
              <p>Light enters the top, meets the diamond&apos;s tiny faces, then bounces back out. When those faces are shaped well, more light can return to your eyes. That is why cut often makes a big difference to sparkle.</p>
              <p className="igi-sparkle__small">This simple drawing is only a guide. Real diamonds and lighting are more complicated.</p>
            </div>
            <div className="igi-light-demo">
              <article className="igi-light-demo__card igi-light-demo__card--bright">
                <svg viewBox="0 0 180 130" role="img" aria-label="Illustration of light entering a well-cut diamond and returning toward the eye">
                  <path className="igi-gem" d="M44 34h92l16 20-62 62-62-62z" />
                  <path className="igi-facet" d="M44 34l46 20 46-20M28 54h124M90 54v62M44 34l46 82 46-82M28 54l62 62 62-62" />
                  <path className="igi-ray" d="M90 4v28m0 22L54 22m36 32 38-31" />
                  <path className="igi-ray-head" d="M84 12l6-8 6 8M48 29l6-7 4 9M128 29l-2-9 9 5" />
                </svg>
                <h3>More light comes back</h3><p>Often looks bright and lively</p>
              </article>
              <article className="igi-light-demo__card igi-light-demo__card--dim">
                <svg viewBox="0 0 180 130" role="img" aria-label="Illustration of light leaking through the side of a poorly proportioned diamond">
                  <path className="igi-gem" d="M44 34h92l16 20-62 62-62-62z" />
                  <path className="igi-facet" d="M44 34l46 20 46-20M28 54h124M90 54v62M44 34l46 82 46-82M28 54l62 62 62-62" />
                  <path className="igi-ray igi-ray--muted" d="M90 4v28m0 22 54 27" />
                  <path className="igi-ray-head igi-ray-head--muted" d="M84 12l6-8 6 8m49 36 8 6-9 3" />
                </svg>
                <h3>More light slips away</h3><p>May look less bright</p>
              </article>
            </div>
          </section>

          <section className="igi-choice" aria-labelledby="igi-choice-title">
            <div className="igi-section-heading">
              <p className="igi-eyebrow">Good, better, best · what do those words mean?</p>
              <h2 id="igi-choice-title">The best diamond is the one that looks best to you.</h2>
              <p>These are shopper-friendly ways to compare—not official grades used by grading laboratories.</p>
            </div>
            <div className="igi-choice__grid">
              <article><span>GOOD</span><h3>Lovely and sensible</h3><p>Looks bright to your eyes, feels right for your budget, and has a report that matches the stone.</p></article>
              <article><span>BETTER</span><h3>A balance you love</h3><p>Put more of your budget toward the details you notice most — often sparkle and face-up size — then balance the rest.</p></article>
              <article><span>BEST FOR YOU</span><h3>Worth the extra?</h3><p>Top grades can be wonderful, but a higher letter or number may be hard to see without a magnifier. Pay more only when that difference matters to you.</p></article>
            </div>
            <p className="igi-choice__note">A diamond can have a top grade and still not be your favourite. Look at the actual stone, not just the scorecard.</p>
            <aside className="igi-red-flags" aria-labelledby="igi-red-flags-title">
              <div><p className="igi-eyebrow">Pause and ask questions</p><h3 id="igi-red-flags-title">A few things that deserve a closer look</h3></div>
              <ul>
                <li>The seller won&apos;t share the grading report number.</li>
                <li>The report says one origin, but the listing says another.</li>
                <li>The report&apos;s measurements or shape don&apos;t match the diamond being shown.</li>
                <li>You&apos;re asked to decide before you can inspect the stone or its report.</li>
              </ul>
            </aside>
          </section>

          <section className="igi-buy" aria-labelledby="igi-buy-title">
            <div className="igi-section-heading">
              <p className="igi-eyebrow">A simple way to shop</p>
              <h2 id="igi-buy-title">Six steps before you say “this one.”</h2>
            </div>
            <ol className="igi-buy__steps">
              <li><b>Pick your budget.</b><span>Decide what feels comfortable before comparing diamonds.</span></li>
              <li><b>Choose a shape you love.</b><span>Round, oval, pear, and other shapes each look different.</span></li>
              <li><b>Look for sparkle.</b><span>Compare cut details and watch how the diamond looks in ordinary light.</span></li>
              <li><b>Check the size in millimetres.</b><span>Carat is weight. Measurements tell you more about how wide the diamond looks from above.</span></li>
              <li><b>Balance color and clarity.</b><span>Ask what you can see without a magnifier, especially once the diamond is in its setting.</span></li>
              <li><b>Read and verify the report.</b><span>Make sure the report describes the same diamond you are buying.</span></li>
            </ol>
          </section>

          <section className="igi-origin">
            <div>
              <p className="igi-eyebrow">First, check what kind of diamond it is</p>
              <h2>Natural or laboratory grown? The report should tell you.</h2>
              <p>Both are diamonds, but they have different origins. Look for the diamond description and origin on the report so you know exactly what you are choosing. Then compare the 4Cs within that category.</p>
            </div>
            <div className="igi-origin__note"><span aria-hidden>i</span><p>Look for the diamond description and origin wording on the report. If you are unsure what a particular line means, ask the jeweller to walk you through it.</p></div>
          </section>

          <section className="igi-gold" id="gold-hallmarking" aria-labelledby="igi-gold-title">
            <div className="igi-gold__intro">
              <p className="igi-eyebrow">Gold has a quality mark, too</p>
              <h2 id="igi-gold-title">What does a BIS hallmark tell you?</h2>
              <p>Think of it as a tiny quality label on your gold jewellery. In India, BIS hallmarking gives you a way to check the gold&apos;s stated purity—and a unique number you can verify.</p>
              <p>At VAIRIS, our gold jewellery is BIS hallmarked. It matters because gold purity affects what you are buying, and the mark gives you something specific to inspect instead of relying on a promise alone.</p>
            </div>
            <div className="igi-gold__marks" aria-label="Illustration of the three parts of a current BIS hallmark">
              <div className="igi-gold__sample"><span className="igi-gold__bis">BIS</span><span className="igi-gold__purity">22K · 916</span><span className="igi-gold__huid">HUID · A1B2C3</span></div>
              <p className="igi-gold__caption">Illustrative example only. Markings and fineness vary by item.</p>
              <ul>
                <li><b>BIS mark</b><span>Shows the hallmark is under the Bureau of Indian Standards system.</span></li>
                <li><b>Purity / fineness</b><span>Shows the declared gold content. For example, 22K 916 means 916 parts gold per 1,000.</span></li>
                <li><b>HUID</b><span>A unique six-character alphanumeric ID for that hallmarked article.</span></li>
              </ul>
            </div>
            <div className="igi-gold__check">
              <span className="igi-gold__check-icon" aria-hidden>✓</span>
              <div><h3>How to check before you buy</h3><p>Look for the BIS mark, fineness and HUID on the jewellery. Open the official BIS Care app, choose “Verify HUID,” and enter the HUID to check the hallmarked item details. If anything does not match, pause and ask the jeweller to explain it.</p></div>
              <a href="https://www.bis.gov.in/bis-apps/?lang=en" target="_blank" rel="noreferrer">BIS Care app information ↗</a>
            </div>
          </section>

          <section className="igi-verify">
            <div className="igi-verify__mark" aria-hidden>✓</div>
            <div>
              <p className="igi-eyebrow">Have a report number?</p>
              <h2>Check it with its grading lab.</h2>
              <p>Think of the report number like a library-book number. Use it on the grading laboratory&apos;s official website to find the matching report and compare its details with the diamond.</p>
            </div>
            <div className="igi-verify__links"><a className="btn btn-primary" href="https://www.gia.edu/report-check-landing" target="_blank" rel="noreferrer">GIA Report Check ↗</a><a href="https://www.igi.org/Verify-Your-Report/" target="_blank" rel="noreferrer">IGI report lookup ↗</a></div>
          </section>

          <section className="igi-verify-steps" aria-label="Steps to check a diamond report">
            <ol>
              <li><span>1</span><div><b>Find the report number</b><p>Look near the top of the printed or digital grading report.</p></div></li>
              <li><span>2</span><div><b>Visit the grading laboratory&apos;s website</b><p>Use its official report lookup or scan the report&apos;s QR code.</p></div></li>
              <li><span>3</span><div><b>Compare the details</b><p>Check the origin, shape, measurements, and 4Cs on the online copy against the report and product you are buying.</p></div></li>
              <li><span>4</span><div><b>Ask about a tiny inscription</b><p>If the diamond has a laser inscription, ask a jeweller to check that number under magnification against the report.</p></div></li>
            </ol>
            <p>Not every diamond has a laser inscription. Matching the online report is useful, but the stone and its details should still be checked together.</p>
          </section>

          <section className="igi-limits">
            <p className="igi-eyebrow">A useful distinction</p>
            <h2>A grading report is information, not a price tag.</h2>
            <p>A grading report is an expert&apos;s description of a diamond — not a promise that it will be your favourite, and not a price tag. It is not an appraisal, warranty, or guarantee of resale value. The jewellery price also includes things like the setting, metal, craftsmanship, and taxes.</p>
          </section>

          <section className="igi-faq">
            <h2>Common questions</h2>
            <Accordion items={[
              { id: "igi-1", question: "Does a grading report mean every diamond is identical?", answer: "No. Each diamond has its own combination of measurements and grades. Two diamonds with the same carat weight can still differ in cut, color, clarity, and appearance." },
              { id: "igi-2", question: "Is a diamond report the same as an appraisal?", answer: "No. A grading report records gemological observations; it does not set a retail price or insurance value." },
              { id: "igi-3", question: "What should I compare first?", answer: "Start with origin, then compare the 4Cs together. Shape, proportions, setting, and how you plan to wear the piece matter too." },
            ]} />
          </section>

          <section className="igi-guides" aria-labelledby="igi-guides-title">
            <div className="igi-section-heading">
              <p className="igi-eyebrow">More to explore</p>
              <h2 id="igi-guides-title">Stories and guides from VAIRIS.</h2>
              <p>Keep learning about the details, stories, and care behind fine jewellery.</p>
            </div>
            <div className="igi-guides__grid">
              {marketingGuides.map((guide) => (
                <Link className="igi-guide-card" href={guide.href} key={guide.href}>
                  <div className="igi-guide-card__art"><GuideArtwork kind={guide.art} /></div>
                  <div className="igi-guide-card__copy">
                    <span>{guide.category}</span>
                    <h3>{guide.title}</h3>
                    <p>{guide.description}</p>
                    <i>Explore guide <b aria-hidden>→</b></i>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <p className="igi-source">Learn more: <a href="https://4cs.gia.edu/en-us/grading-diamond-4cs/" target="_blank" rel="noreferrer">GIA&apos;s 4Cs and grading guide</a>, <a href="https://www.igi.org/consumer-education/diamond-4cs/" target="_blank" rel="noreferrer">IGI&apos;s 4Cs guide</a>, <a href="https://www.bis.gov.in/hallmarking-overview/hallmarking-faqs/hallmarking-faq/?lang=en" target="_blank" rel="noreferrer">BIS hallmarking FAQs</a>, and <a href="https://www.bis.gov.in/hallmarking-overview/consumer-protection/?lang=en" target="_blank" rel="noreferrer">BIS consumer protection guidance</a>.</p>
          <div className="igi-next-link"><Link href="/why-vairis">See how VAIRIS brings clarity to every choice <span aria-hidden>→</span></Link></div>
        </Container>
      </main>
    </PageShell>
  );
}
