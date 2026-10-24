"use client";

import { useRef, useState } from "react";
import { ProductImage } from "@/components/ui/ProductImage";

export type PlpLook = { id: string; image: string; label: string; handle: string };

/** Real People row: swipeable on phones with a position indicator, a plain row on desktop. */
export function PlpPeopleRow({ looks }: { looks: PlpLook[] }) {
  const rowRef = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);

  const onScroll = () => {
    const row = rowRef.current;
    if (!row) return;
    const max = row.scrollWidth - row.clientWidth;
    setActive(max <= 0 ? 0 : Math.round((row.scrollLeft / max) * (looks.length - 1)));
  };

  return (
    <>
      <ul className="plp-people__row" ref={rowRef} onScroll={onScroll}>
        {looks.map((look) => (
          <li key={look.id} className="plp-people__item">
            <div className="plp-people__photo">
              <ProductImage src={look.image} alt={`${look.label}: customer wearing Vairis`} width={400} height={520} />
            </div>
            <span className="plp-people__label">{look.label}</span>
            {look.handle && <span className="plp-people__handle">{look.handle}</span>}
          </li>
        ))}
      </ul>
      <div className="plp-people__dots" aria-hidden="true">
        {looks.map((look, i) => (
          <span key={look.id} className={i === active ? "is-active" : ""} />
        ))}
      </div>
    </>
  );
}
