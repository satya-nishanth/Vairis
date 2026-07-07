"use client";

import { useEffect } from "react";

type LegacyCategoryRedirectProps = {
  href: string;
};

/** Client redirect for static export (next.config redirects are not applied on export). */
export function LegacyCategoryRedirect({ href }: LegacyCategoryRedirectProps) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);

  return (
    <p style={{ padding: "2rem", textAlign: "center" }}>
      Redirecting…{" "}
      <a href={href}>Continue to {href}</a>
    </p>
  );
}
