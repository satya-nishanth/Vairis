type IconCategory = "brand" | "commerce" | "navigation" | "content" | "social";

type ThemeIconProps = {
  name: string;
  category?: IconCategory;
  size?: number;
  className?: string;
  alt?: string;
};

export function ThemeIcon({ name, category = "brand", size = 32, className, alt = "" }: ThemeIconProps) {
  const base = `/icons`;
  const cls = ["theme-icon-pair", className].filter(Boolean).join(" ");

  return (
    <span className={cls} style={{ width: size, height: size }} aria-hidden={alt ? undefined : true}>
      <img
        src={`${base}/light/${category}/${name}_light.svg`}
        alt={alt}
        width={size}
        height={size}
        className="theme-icon theme-icon--light"
      />
      <img
        src={`${base}/dark/${category}/${name}_dark.svg`}
        alt={alt}
        width={size}
        height={size}
        className="theme-icon theme-icon--dark"
      />
    </span>
  );
}

type SharedIconProps = {
  name: string;
  category?: IconCategory | "brand";
  size?: number;
  className?: string;
};

export function SharedIcon({ name, category = "content", size = 16, className }: SharedIconProps) {
  return (
    <img
      src={`/icons/shared/${category}/${name}.svg`}
      alt=""
      width={size}
      height={size}
      className={className}
      aria-hidden
    />
  );
}

export function IconChevronRight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
