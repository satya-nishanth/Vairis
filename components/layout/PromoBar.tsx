"use client";

import { useEffect, useState } from "react";
import type { PromoBarVariant } from "@/lib/layout-config";
import { ThemeIcon } from "@/components/icons/ThemeIcon";
import { announcementBarItems, utilityBarItems } from "@/lib/promo-bar-content";
import type { BannerContent } from "@/lib/site-content";

type PromoBarProps = {
  variant: Exclude<PromoBarVariant, "none">;
};

/**
 * Promo bar — admin-customizable via the "promo-bar" SiteBanner slot
 * (/admin/content). Renders the built-in items immediately; if an active
 * banner row exists it swaps to that single message (+ optional link)
 * after load. No row → defaults stay, so this can never blank the bar.
 *
 * Client component because PageShell renders inside client trees (PLP,
 * cart, checkout) — content comes from /api/content/promo-bar.
 */
export function PromoBar({ variant }: PromoBarProps) {
  const [banner, setBanner] = useState<BannerContent | null>(null);

  useEffect(() => {
    fetch("/api/content/promo-bar")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.banner?.title) setBanner(data.banner);
      })
      .catch(() => {
        /* keep defaults */
      });
  }, []);

  const isAnnouncement = variant === "announcement";
  const items = isAnnouncement ? announcementBarItems : utilityBarItems;
  const barClass = isAnnouncement ? "announcement-bar" : "utility-bar";
  const itemClass = isAnnouncement ? "announcement-bar__item" : "utility-bar__item";
  const innerClass = isAnnouncement ? "announcement-bar__inner" : "utility-bar__inner";
  const iconSize = isAnnouncement ? 14 : 16;

  if (banner?.title) {
    const text = <span className={itemClass}>{banner.title}</span>;
    return (
      <div className={barClass}>
        <div className={innerClass}>
          {banner.linkUrl ? (
            <a href={banner.linkUrl} className="promo-bar__link">
              {text}
            </a>
          ) : (
            text
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={barClass}>
      <div className={innerClass}>
        {items.map(({ label, icon }) => (
          <span key={label} className={itemClass}>
            <ThemeIcon
              name={icon.name}
              category={icon.category}
              size={iconSize}
              className={`promo-bar__icon${isAnnouncement ? " promo-bar__icon--on-primary" : ""}`}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
