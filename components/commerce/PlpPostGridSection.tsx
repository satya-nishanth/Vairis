import Link from "next/link";
import { CommerceTrustHelpPanel } from "@/components/commerce/CommerceTrustHelpPanel";
import { PlpPeopleRow } from "@/components/commerce/PlpPeopleRow";
import { lifestyleScenes } from "@/lib/ui-data";

type PlpPostGridSectionProps = {
  category?: string;
};

const INITIALS = ["AN", "RV", "KJ"];
const PROOF = ["IGI certified", "BIS hallmarked", "Insured delivery"];

// "Office look @ananya.work" -> label + handle
const looks = lifestyleScenes.map((scene) => {
  const [label, handle = ""] = scene.ugcLabel.split(" @");
  return { id: scene.id, image: scene.image, label, handle: handle ? `@${handle}` : "" };
});

export function PlpPostGridSection({ category }: PlpPostGridSectionProps) {
  const isMenCategory = category === "cufflinks";
  const [first, second] = isMenCategory
    ? ["Refined Details.", "Real Everyday Style."]
    : ["Real People.", "Real Everyday Style."];

  return (
    <div className="plp-post-grid">
      <section className="plp-people" aria-labelledby="plp-people-title">
        <div className="plp-people__head">
          <h2 id="plp-people-title" className="plp-people__title">
            {first}
            <br />
            {second}
          </h2>
          <Link href="/all-products/rings" className="plp-people__cta">
            Explore pieces →
          </Link>
        </div>
        <PlpPeopleRow looks={looks} />
      </section>

      <CommerceTrustHelpPanel />

      {/* Honest trust bar — no fabricated review counts. Real per-product
          ratings render on each PDP from moderated customer reviews. */}
      <section className="plp-crafted" aria-labelledby="plp-crafted-title">
        <div className="plp-crafted__initials" aria-hidden="true">
          {INITIALS.map((i) => (
            <span key={i}>{i}</span>
          ))}
        </div>
        <h2 id="plp-crafted-title" className="plp-crafted__title">
          Crafted to be worn every day
        </h2>
        <span className="plp-crafted__rule" aria-hidden="true" />
        <p className="plp-crafted__proof">
          {PROOF.map((text, i) => (
            <span key={text} className="plp-crafted__proof-item">
              {i > 0 && <span className="plp-crafted__diamond" aria-hidden="true" />}
              {text}
            </span>
          ))}
        </p>
        <Link href="/all-products/rings" className="plp-crafted__cta">
          Shop the collection →
        </Link>
      </section>
    </div>
  );
}
