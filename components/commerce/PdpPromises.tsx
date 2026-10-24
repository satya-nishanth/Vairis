import Link from "next/link";

const ICONS = {
  ship: "M3 6h11v10H3zM14 10h4l3 3v3h-7M5 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0M15 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0",
  returns: "M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4",
  care: "M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3zM9 12l2 2 4-4",
};

/** Three icon tiles under the photos (desktop) / under the buttons (mobile). */
export function PdpPromises({ className, careNote }: { className?: string; careNote: string | null }) {
  const tiles = [
    { icon: ICONS.ship, title: "Insured shipping", sub: "Free across India", href: "/policies/shipping" },
    { icon: ICONS.returns, title: "15-day returns", sub: "Simple refunds", href: "/returns" },
    ...(careNote
      ? [{ icon: ICONS.care, title: "Lifetime care", sub: careNote, href: "/policies/terms" }]
      : []),
  ];
  return (
    <ul
      className={["pdp-promises", className].filter(Boolean).join(" ")}
      aria-label="Our promises"
      style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}
    >
      {tiles.map((t) => (
        <li key={t.title}>
          <Link href={t.href} className="pdp-promises__tile">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={t.icon} />
            </svg>
            <strong>{t.title}</strong>
            <span>{t.sub}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
