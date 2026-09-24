import type { ReactNode } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { pageLayouts } from "@/lib/layout-config";

export function PolicyPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <PageShell
      {...pageLayouts.contact}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: title },
      ]}
    >
      <Container>
        <article className="policy-page">
          <h1>{title}</h1>
          <p className="policy-page__updated">Last updated: {updated}</p>
          {children}
        </article>
      </Container>
    </PageShell>
  );
}
