"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LOGO_SRC } from "@/lib/logo";
import {
  DEFAULT_SITE_THEME,
  isSiteTheme,
  type SiteTheme,
  THEME_LABELS,
} from "@/lib/theme";

const STORAGE_KEY = "vairis-site-theme";

type ThemeContextValue = {
  theme: SiteTheme;
  setTheme: (theme: SiteTheme) => void;
  logoSrc: string;
};

const defaultContext: ThemeContextValue = {
  theme: DEFAULT_SITE_THEME,
  setTheme: () => {},
  logoSrc: LOGO_SRC,
};

const ThemeContext = createContext<ThemeContextValue>(defaultContext);

function applyTheme(theme: SiteTheme) {
  document.documentElement.setAttribute("data-theme", theme);
}

type ThemeProviderProps = {
  defaultTheme?: SiteTheme;
  children: React.ReactNode;
};

export function ThemeProvider({ defaultTheme = DEFAULT_SITE_THEME, children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<SiteTheme>(defaultTheme);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const resolved = stored && isSiteTheme(stored) ? stored : defaultTheme;
    // SSR renders defaultTheme; syncing from localStorage post-mount is the
    // hydration-safe pattern (a lazy initializer would mismatch the server HTML)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(resolved);
    applyTheme(resolved);
  }, [defaultTheme]);

  const setTheme = useCallback((next: SiteTheme) => {
    setThemeState(next);
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      logoSrc: LOGO_SRC,
    }),
    [theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { THEME_LABELS };
