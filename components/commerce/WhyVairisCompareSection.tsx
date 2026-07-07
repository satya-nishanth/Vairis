import { Button } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/Section";
import { ThemeIcon } from "@/components/icons/ThemeIcon";
import { compareTrustItems } from "@/lib/compare-trust-content";

export function WhyVairisCompareSection() {
  return (
    <section className="why-vairis-compare">
      <div className="why-vairis-compare__main">
        <SectionHeader title="Why Vairis Price is Better" />
        <p className="why-vairis-compare__lead">
          No showroom rent passed on to you — transparent pricing on gold and diamonds.
        </p>
        <table className="compare-table">
          <thead>
            <tr>
              <th></th>
              <th>Traditional</th>
              <th>Vairis</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Showroom Costs</td>
              <td>High markups</td>
              <td>None</td>
            </tr>
            <tr>
              <td>Design Philosophy</td>
              <td>Occasion-heavy</td>
              <td>Everyday minimal</td>
            </tr>
            <tr>
              <td>Pricing</td>
              <td>Opaque</td>
              <td>Transparent</td>
            </tr>
          </tbody>
        </table>
        <Button href="/contact" variant="secondary" size="sm" className="why-vairis-compare__action">
          Know More
        </Button>
      </div>

      <aside className="why-vairis-compare__aside">
        <h3 className="why-vairis-compare__aside-title">Certified &amp; 100% Authentic</h3>
        <p className="why-vairis-compare__aside-lead">
          Every Vairis diamond comes with IGI certification and BIS hallmark.
        </p>
        <ul className="why-vairis-compare__trust" aria-label="Shopping guarantees">
          {compareTrustItems.map(({ icon, label }) => (
            <li key={label} className="why-vairis-compare__trust-item">
              <ThemeIcon name={icon.name} category={icon.category} size={40} className="why-vairis-compare__trust-icon" />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </aside>
    </section>
  );
}
