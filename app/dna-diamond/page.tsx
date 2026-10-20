import type { Metadata } from "next";
import Image from "next/image";
import Script from "next/script";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { DnaHeroCarousel } from "@/components/content/DnaHeroCarousel";
import { pageLayouts } from "@/lib/layout-config";
import { WHATSAPP_URL } from "@/lib/ui-data";

export const metadata: Metadata = {
  title: "DNA Diamond — Keep a Loved One Close",
  description:
    "A personal diamond created using purified carbon derived from a loved one's sample, with traceability from collection through cutting.",
};

const processSteps = [
  {
    number: "01",
    title: "A sample, carefully received",
    text: "A biological sample such as hair is collected and entered into a chain-of-custody logbook. From the first handover, its journey is documented.",
    note: "Collection & custody",
  },
  {
    number: "02",
    title: "A name and a unique identity",
    text: "Customer details are recorded, and the sample and its specially marked Petri dish receive unique IDs. Movements between stages are logged so the sample can be traced throughout the process.",
    note: "Sample identification",
  },
  {
    number: "03",
    title: "Carbon, purified with care",
    text: "The sample goes through a controlled carbon-conversion process. The carbon-rich material is purified to remove impurities, then assigned its own identification number before synthesis.",
    note: "Carbon conversion",
  },
  {
    number: "04",
    title: "A diamond begins to grow",
    text: "The purified carbon-derived material is placed in a diamond synthesizer under controlled growth conditions. The growth stage takes approximately 45 days; the resulting rough is given a unique ID for continued traceability.",
    note: "Diamond synthesis · ~45 days",
  },
  {
    number: "05",
    title: "Cut, polished, and made yours",
    text: "The rough diamond is sent to a specialist for cutting and polishing. The finished stone can then be submitted for grading and certification, and set into the jewellery you choose.",
    note: "Cutting & finishing",
  },
];

export default function DnaDiamondPage() {
  return (
    <PageShell
      {...pageLayouts.contact}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "DNA Diamond" },
      ]}
    >
      <main className="dna-page">
        <Container>
          <DnaHeroCarousel />

          <section className="dna-meaning" aria-labelledby="dna-meaning-title">
            <p className="dna-eyebrow">A different kind of forever</p>
            <h2 id="dna-meaning-title">Not just a diamond. A connection you can carry.</h2>
            <p>
              Made using carbon carefully derived from a personal sample, each DNA diamond begins
              with a story that belongs only to you. It turns something deeply personal into a
              beautiful keepsake — created to be worn close, held onto, and treasured for years to come.
            </p>
            <div className="dna-meaning__facts">
              <div><span className="dna-fact-mark">01</span><span>Created from purified carbon derived from your submitted sample</span></div>
              <div><span className="dna-fact-mark">02</span><span>Uniquely identified and tracked through key stages</span></div>
              <div><span className="dna-fact-mark">03</span><span>Finished as a real diamond, ready for a setting of your choice</span></div>
            </div>
          </section>

          <section className="dna-stories" aria-labelledby="dna-stories-title">
            <div className="dna-stories__heading">
              <p className="dna-eyebrow">Every bond has its own story</p>
              <h2 id="dna-stories-title">A keepsake can begin with someone you love.</h2>
              <p>It could be a parent, a partner, or the companion who has always been by your side. These are illustrative moments; your own story is what makes a DNA Diamond personal.</p>
            </div>
            <div className="dna-stories__grid">
              <figure className="dna-story-card">
                <Image src="/images/dna-diamond-mother-daughter.png" alt="An adult daughter sharing a diamond pendant moment with her mother" width={1536} height={1024} />
                <figcaption><span>For the people who shaped your story</span><small>Illustrative image</small></figcaption>
              </figure>
              <figure className="dna-story-card">
                <Image src="/images/dna-diamond-pet-bond.png" alt="A woman sharing a quiet moment with her beloved dog" width={1536} height={1024} />
                <figcaption><span>For the companion who feels like family</span><small>Illustrative image</small></figcaption>
              </figure>
            </div>
          </section>

          <section className="dna-process" id="the-journey" aria-labelledby="dna-process-title">
            <div className="dna-process__heading">
              <p className="dna-eyebrow">The making of a memory</p>
              <h2 id="dna-process-title">A careful journey, from sample to stone.</h2>
              <p>Traceability, identification, and care accompany the sample from collection through diamond cutting.</p>
            </div>
            <ol className="dna-timeline">
              {processSteps.map((step) => (
                <li className="dna-step" key={step.number}>
                  <div className="dna-step__marker"><span>{step.number}</span></div>
                  <article className="dna-step__card">
                    <p className="dna-step__note">{step.note}</p>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </article>
                </li>
              ))}
            </ol>
            <p className="dna-process__clarifier">
              The diamond is grown from purified carbon derived from the submitted sample; the original DNA strands are not incorporated into the finished stone.
            </p>
          </section>

          <section className="dna-flow" aria-label="DNA diamond production process at a glance">
            <p className="dna-eyebrow">At a glance</p>
            <div className="dna-flow__steps">
              {["Customer sample", "Sample ID & custody", "Carbon conversion & purification", "Purified carbon · unique ID", "Diamond synthesizer", "~45 days of growth", "Rough · unique ID", "Cut & polish", "Grading / final jewellery"].map((label, index) => (
                <div className="dna-flow__item" key={label}>
                  <span>{label}</span>
                  {index < 8 && <span className="dna-flow__arrow" aria-hidden>→</span>}
                </div>
              ))}
            </div>
          </section>

          <section className="dna-cta">
            <div>
              <p className="dna-eyebrow">A personal story deserves a personal conversation</p>
              <h2>Curious about creating a DNA diamond?</h2>
              <p>Talk with our team about the sample, the journey, and what a finished keepsake could look like.</p>
            </div>
            <Button href={WHATSAPP_URL} variant="primary">Start a conversation</Button>
          </section>

          <section className="dna-instagram" aria-labelledby="dna-instagram-title">
            <div className="dna-instagram__heading">
              <p className="dna-eyebrow">From our Instagram</p>
              <h2 id="dna-instagram-title">The story, shared in real moments.</h2>
              <p>See the DNA Diamond journey and a proud moment of recognition for our work.</p>
            </div>
            <div className="dna-instagram__grid">
              <article className="dna-instagram__card">
                <p className="dna-instagram__label">A moment we will always remember</p>
                <h3>Recognised by Telangana&apos;s IT Minister</h3>
                <p>Our DNA Diamond story, and the honour of receiving recognition from the Telangana IT Minister.</p>
                <blockquote
                  className="instagram-media"
                  data-instgrm-permalink="https://www.instagram.com/p/Db3HzwLgalO/?img_index=1"
                  data-instgrm-version="14"
                  aria-label="Instagram post: recognition from Telangana IT Minister"
                >
                  <a href="https://www.instagram.com/p/Db3HzwLgalO/?img_index=1" target="_blank" rel="noreferrer">View this award moment on Instagram ↗</a>
                </blockquote>
              </article>
              <article className="dna-instagram__card">
                <p className="dna-instagram__label">Watch the story</p>
                <h3>DNA Diamond, in a reel</h3>
                <p>A short look at the idea behind turning a personal bond into a diamond you can keep close.</p>
                <blockquote
                  className="instagram-media"
                  data-instgrm-permalink="https://www.instagram.com/reels/Db5obNBhuS9/"
                  data-instgrm-version="14"
                  aria-label="Instagram reel about DNA Diamond"
                >
                  <a href="https://www.instagram.com/reels/Db5obNBhuS9/" target="_blank" rel="noreferrer">Watch the DNA Diamond reel on Instagram ↗</a>
                </blockquote>
              </article>
            </div>
            <Script src="https://www.instagram.com/embed.js" strategy="afterInteractive" />
          </section>
        </Container>
      </main>
    </PageShell>
  );
}
