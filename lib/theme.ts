import { LOGO_SRC } from "@/lib/logo";

/** Site-wide color theme - switch via NEXT_PUBLIC_SITE_THEME or ThemeProvider. */
export type SiteTheme = "light" | "dark";

export const SITE_THEMES: SiteTheme[] = ["light", "dark"];

export const THEME_LABELS: Record<SiteTheme, string> = {
  light: "Light",
  dark: "Dark",
};

export const DEFAULT_SITE_THEME: SiteTheme =
  process.env.NEXT_PUBLIC_SITE_THEME === "dark" ? "dark" : "light";

export function isSiteTheme(value: string): value is SiteTheme {
  return value === "light" || value === "dark";
}

/** @deprecated Theme no longer swaps logo assets; use LOGO_SRC from @/lib/logo */
export function getLogoSrc(_theme?: SiteTheme): string {
  return LOGO_SRC;
}
