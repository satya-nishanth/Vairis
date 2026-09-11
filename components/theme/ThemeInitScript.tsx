"use client";

import { useServerInsertedHTML } from "next/navigation";
import { DEFAULT_SITE_THEME } from "@/lib/theme";

const THEME_INIT_SCRIPT = `(function(){try{var k="vairis-site-theme",t=localStorage.getItem(k);if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);else document.documentElement.setAttribute("data-theme","${DEFAULT_SITE_THEME}");}catch(e){document.documentElement.setAttribute("data-theme","${DEFAULT_SITE_THEME}");}})();`;

/**
 * Applies stored theme before paint to avoid flash.
 * Injected via useServerInsertedHTML so React 19 never sees a <script> in the
 * client component tree (next/script beforeInteractive triggers that warning).
 */
export function ThemeInitScript() {
  useServerInsertedHTML(() => (
    <script
      id="vairis-theme-init"
      dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
    />
  ));

  return null;
}
