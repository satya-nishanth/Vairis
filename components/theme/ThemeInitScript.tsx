import Script from "next/script";
import { DEFAULT_SITE_THEME } from "@/lib/theme";

/** Applies stored theme before paint to avoid flash (React 19–safe via next/script). */
export function ThemeInitScript() {
  const script = `(function(){try{var k="vairis-site-theme",t=localStorage.getItem(k);if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);else document.documentElement.setAttribute("data-theme","${DEFAULT_SITE_THEME}");}catch(e){document.documentElement.setAttribute("data-theme","${DEFAULT_SITE_THEME}");}})();`;

  return (
    <Script id="vairis-theme-init" strategy="beforeInteractive">
      {script}
    </Script>
  );
}
