"use client";

import { useState } from "react";
import Link from "next/link";
import { IconChevronRight } from "@/components/icons/ThemeIcon";

type AccordionSection = {
  title: string;
  links: ReadonlyArray<{ label: string; href: string }>;
};

type FooterAccordionProps = {
  sections: AccordionSection[];
  className?: string;
};

export function FooterAccordion({ sections, className }: FooterAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className={["site-footer__accordion", className].filter(Boolean).join(" ")}>
      {sections.map((section, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={section.title} className={`accordion__item${isOpen ? " is-open" : ""}`}>
            <button
              type="button"
              className="accordion__trigger"
              aria-expanded={isOpen}
              onClick={() => setOpenIndex(isOpen ? null : i)}
            >
              {section.title}
              <IconChevronRight className={`accordion__chevron${isOpen ? " is-open" : ""}`} />
            </button>
            <div className="accordion__panel">
              {section.links.map(({ label, href }) => (
                <Link key={label} href={href}>
                  {label}
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
