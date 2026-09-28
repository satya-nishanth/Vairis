import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageShell } from "@/components/layout/PageShell";
import { pageLayouts } from "@/lib/layout-config";
import { ProductImage } from "@/components/ui/ProductImage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Curated Collections | VAIRIS",
  description: "Explore our curated edits of minimal fine diamond jewellery. Handcrafted in 18kt and 14kt gold for modern everyday wear.",
};

export default async function CollectionsIndexPage() {
  const collections = await prisma.collection.findMany({
    where: {
      active: true,
      products: {
        some: {
          product: {
            isActive: true,
            status: "LIVE",
          },
        },
      },
    },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: {
        select: {
          products: {
            where: {
              product: {
                isActive: true,
                status: "LIVE",
              },
            },
          },
        },
      },
    },
  });

  return (
    <PageShell
      {...pageLayouts.plp}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Collections" },
      ]}
    >
      <main className="container page-main plp-main" style={{ paddingBlock: "2rem 4rem" }}>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <h1
            style={{
              fontFamily: "var(--font-serif, serif)",
              fontSize: "clamp(2rem, 4vw, 2.75rem)",
              fontWeight: 400,
              letterSpacing: "0.04em",
              marginBottom: "0.75rem",
            }}
          >
            Curated Collections
          </h1>
          <p
            style={{
              color: "var(--color-text-muted)",
              fontSize: "1rem",
              maxWidth: "540px",
              marginInline: "auto",
            }}
          >
            Distinctive edits curated for modern moments, everyday confidence, and celebrations.
          </p>
        </div>

        {collections.length === 0 ? (
          <div className="plp-empty" style={{ textAlign: "center", padding: "4rem 1rem" }}>
            <h2>New Collections Coming Soon</h2>
            <p>Our artisans are curating new edits. Explore our core jewellery pieces meanwhile.</p>
            <Link href="/all-products/rings" className="btn btn-primary" style={{ marginTop: "1rem" }}>
              Shop Rings
            </Link>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "24px",
            }}
          >
            {collections.map((c) => {
              const coverImage = c.heroImages[0] ?? "";
              const count = c._count.products;
              return (
                <Link
                  key={c.id}
                  href={`/collections/${c.slug}`}
                  style={{
                    display: "block",
                    textDecoration: "none",
                    color: "inherit",
                    background: "var(--color-surface, #fff)",
                    border: "1px solid var(--color-border-light, #f0f0f0)",
                    borderRadius: "12px",
                    overflow: "hidden",
                    transition: "transform 0.2s ease, box-shadow 0.2s ease",
                  }}
                  className="collection-card"
                >
                  <div style={{ position: "relative", width: "100%", height: "240px", background: "var(--color-surface-muted, #f8f8f8)" }}>
                    {coverImage ? (
                      <ProductImage
                        src={coverImage}
                        alt={c.title}
                        fill
                        style={{ objectFit: "cover" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--color-text-muted)",
                          fontSize: "0.875rem",
                        }}
                      >
                        VAIRIS Collection
                      </div>
                    )}
                  </div>
                  <div style={{ padding: "1.25rem 1.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
                      <h2
                        style={{
                          fontFamily: "var(--font-serif, serif)",
                          fontSize: "1.375rem",
                          fontWeight: 500,
                          margin: 0,
                        }}
                      >
                        {c.title}
                      </h2>
                      <span
                        style={{
                          fontSize: "0.8125rem",
                          color: "var(--color-text-muted)",
                          fontWeight: 500,
                        }}
                      >
                        {count} {count === 1 ? "piece" : "pieces"}
                      </span>
                    </div>
                    {c.subtitle && (
                      <p
                        style={{
                          fontSize: "0.875rem",
                          color: "var(--color-text-muted)",
                          margin: 0,
                          lineHeight: 1.5,
                        }}
                      >
                        {c.subtitle}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </PageShell>
  );
}
