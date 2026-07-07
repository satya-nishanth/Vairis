import type { PromoBarVariant } from "@/lib/layout-config";
import { ThemeIcon } from "@/components/icons/ThemeIcon";
import { announcementBarItems, utilityBarItems } from "@/lib/promo-bar-content";

type PromoBarProps = {
  variant: Exclude<PromoBarVariant, "none">;
};

export function PromoBar({ variant }: PromoBarProps) {
  const isAnnouncement = variant === "announcement";
  const items = isAnnouncement ? announcementBarItems : utilityBarItems;
  const barClass = isAnnouncement ? "announcement-bar" : "utility-bar";
  const itemClass = isAnnouncement ? "announcement-bar__item" : "utility-bar__item";
  const innerClass = isAnnouncement ? "announcement-bar__inner" : "utility-bar__inner";
  const iconSize = isAnnouncement ? 14 : 16;

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
