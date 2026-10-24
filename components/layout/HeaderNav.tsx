"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { NAV_PANELS, type NavPanelId } from "@/lib/nav-menu-content";
import { NavIcon } from "./NavIcons";
import { useNavData } from "./nav-data";

function Chevron() {
  return <span className="nav-chevron" aria-hidden="true" />;
}

/** Desktop menu row: category links, plus Rings / Collections / The Vairis story open a full-width panel. */
export function HeaderNav() {
  const { categories, collections } = useNavData();
  const pathname = usePathname();
  // The open panel belongs to the page it was opened on, so navigating closes it.
  const [openPanel, setOpenPanel] = useState<{ id: NavPanelId; path: string } | null>(null);
  const active = openPanel && openPanel.path === pathname ? openPanel.id : null;
  const wrapRef = useRef<HTMLDivElement>(null);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);

  const close = useCallback((returnFocus = false) => {
    setOpenPanel(null);
    if (returnFocus) lastTrigger.current?.focus();
  }, []);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [active, close]);

  const toggle = (id: NavPanelId, el: HTMLButtonElement) => {
    lastTrigger.current = el;
    setOpenPanel(active === id ? null : { id, path: pathname });
  };

  const trigger = (id: NavPanelId) => (
    <button
      type="button"
      className="nav-row__item"
      aria-expanded={active === id}
      aria-controls="nav-mega"
      onClick={(e) => toggle(id, e.currentTarget)}
    >
      {NAV_PANELS[id].label}
      <Chevron />
    </button>
  );

  const hasRings = categories.some((c) => c.slug === "rings");
  const others = categories.filter((c) => c.slug !== "rings");

  const panel = active ? NAV_PANELS[active] : null;
  const panelLinks =
    active === "collections" && collections.length > 0
      ? [...collections, { label: "All collections", href: "/collections" }]
      : panel
        ? active === "collections"
          ? [...panel.links, { label: "All collections", href: "/collections" }]
          : panel.links
        : [];

  return (
    <div className="nav-row" ref={wrapRef}>
      <nav className="nav-row__bar" aria-label="Main">
        <div className="nav-row__group">
          {hasRings && trigger("rings")}
          {others.map((c) => (
            <Link key={c.slug} href={c.href} className="nav-row__item">
              {c.name}
            </Link>
          ))}
          {trigger("collections")}
        </div>
        <div className="nav-row__group nav-row__group--brand">
          <Link href="/dna-diamond" className="nav-row__item nav-row__item--dna">
            <NavIcon name="diamond" size={17} />
            DNA Diamond
          </Link>
          {trigger("vairis")}
        </div>
      </nav>

      {panel && (
        <>
          <div className="nav-row__shade" aria-hidden="true" onClick={() => close()} />
          <section id="nav-mega" className="nav-mega" aria-label={`${panel.label} menu`}>
            <div className="nav-mega__layout">
              <div>
                <p className="nav-eyebrow">{panel.eyebrow}</p>
                <h2 className="nav-mega__heading">
                  {panel.title[0]}
                  <br />
                  {panel.title[1]}
                </h2>
                <p className="nav-mega__copy">{panel.copy}</p>
                <Link href={panel.allHref} className="nav-link-all" onClick={() => close()}>
                  {panel.allLabel}
                  <NavIcon name="arrow" size={18} />
                </Link>
              </div>

              <div className="nav-mega__links">
                <p className="nav-eyebrow">{panel.group}</p>
                {panelLinks.map((l) => (
                  <Link key={l.href} href={l.href} onClick={() => close()}>
                    {l.label}
                    <NavIcon name="arrow" size={16} />
                  </Link>
                ))}
                {panel.chips.length > 0 && (
                  <div className="nav-mega__chips">
                    {panel.chips.map((c) => (
                      <span key={c}>{c}</span>
                    ))}
                  </div>
                )}
              </div>

              <Link href={panel.feature.href} className="nav-feature" onClick={() => close()}>
                <Image src={panel.feature.image} alt="" width={190} height={200} sizes="190px" />
                <div className="nav-feature__body">
                  <p className="nav-eyebrow">{panel.feature.eyebrow}</p>
                  <h3>
                    {panel.feature.title[0]}
                    <br />
                    {panel.feature.title[1]}
                  </h3>
                  <p>{panel.feature.copy}</p>
                  <span className="nav-link-all">
                    {panel.feature.cta}
                    <NavIcon name="arrow" size={18} />
                  </span>
                </div>
              </Link>
            </div>

            <div className="nav-mega__foot">
              <span>
                <i aria-hidden="true" /> Certified diamonds. Hallmarked gold. Thoughtfully made.
              </span>
              <Link href="/contact" onClick={() => close()}>
                Need a little guidance? Talk to us
                <NavIcon name="arrow" size={15} />
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
