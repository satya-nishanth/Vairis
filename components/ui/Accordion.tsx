"use client";

import { useState } from "react";

export type AccordionItem = {
  id: string;
  question: string;
  answer: React.ReactNode;
};

type AccordionProps = {
  items: AccordionItem[];
  defaultOpenId?: string;
  className?: string;
};

export function Accordion({ items, defaultOpenId, className }: AccordionProps) {
  const [openId, setOpenId] = useState(defaultOpenId ?? items[0]?.id);

  return (
    <div className={["accordion", className].filter(Boolean).join(" ")}>
      {items.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div key={item.id} className={isOpen ? "accordion__item is-open" : "accordion__item"}>
            <button
              type="button"
              className="accordion__trigger"
              onClick={() => setOpenId(isOpen ? "" : item.id)}
              aria-expanded={isOpen}
            >
              {item.question}
            </button>
            <div className="accordion__panel">{item.answer}</div>
          </div>
        );
      })}
    </div>
  );
}
