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
 * banner row exists it swaps to that message (+ optional link) after load.
 * Multiple rotating messages: separate them with " | " in the title —
 * the bar cycles every 5s. No row → defaults stay, never blanks the bar.
 *
 * Client component because PageShell renders inside client trees (PLP,
 * cart, checkout) — content comes from /api/content/promo-bar.
 */
export function PromoBar({ variant }: PromoBarProps) {
  const [banner, setBanner] = useState<BannerContent | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);

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

  const messages = (banner?.title ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  useEffect(() => {
    if (messages.length < 2) return;
    const t = setInterval(() => setMessageIndex((i) => (i + 1) % messages.length), 5000);
    return () => clearInterval(t);
  }, [messages.length]);

  const isAnnouncement = variant === "announcement";
  const items = isAnnouncement ? announcementBarItems : utilityBarItems;
  const barClass = isAnnouncement ? "announcement-bar" : "utility-bar";
  const itemClass = isAnnouncement ? "announcement-bar__item" : "utility-bar__item";
  const innerClass = isAnnouncement ? "announcement-bar__inner" : "utility-bar__inner";
  const iconSize = isAnnouncement ? 14 : 16;

  if (messages.length > 0) {
    const message = messages[messageIndex % messages.length];
    const text = <span className={itemClass}>{message}</span>;
    return (
      <div className={barClass}>
        <div className={innerClass}>
          {banner?.linkUrl ? (
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
