"use client";

import { SITE_THEMES, THEME_LABELS } from "@/lib/theme";
import { useTheme } from "./ThemeProvider";

/** Compact theme toggle for wireframe / QA - lives in the header. */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className={["theme-switcher", className].filter(Boolean).join(" ")} role="group" aria-label="Color theme">
      {SITE_THEMES.map((id) => (
        <button
          key={id}
          type="button"
          className={theme === id ? "is-active" : ""}
          onClick={() => setTheme(id)}
          aria-pressed={theme === id}
        >
          {THEME_LABELS[id]}
        </button>
      ))}
    </div>
  );
}
