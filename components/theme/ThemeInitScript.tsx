import { DEFAULT_SITE_THEME } from "@/lib/theme";

/** Applies stored theme before paint to avoid flash. */
export function ThemeInitScript() {
  const script = `(function(){try{var k="vairis-site-theme",t=localStorage.getItem(k);if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);else document.documentElement.setAttribute("data-theme","${DEFAULT_SITE_THEME}");}catch(e){document.documentElement.setAttribute("data-theme","${DEFAULT_SITE_THEME}");}})();`;

  return (
    <script
      id="vairis-theme-init"
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning
    />
  );
}
