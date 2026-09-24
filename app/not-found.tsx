import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { pageLayouts } from "@/lib/layout-config";
import { STOCKED_CATEGORIES, CATEGORY_LABELS } from "@/lib/catalogue-ui";
import { WHATSAPP_URL } from "@/lib/ui-data";

export default function NotFound() {
  const layout = pageLayouts.contact;

  return (
    <PageShell {...layout}>
      <main
        className="container"
        style={{
          minHeight: "65vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "64px 20px",
        }}
      >
        <p
          style={{
            fontSize: "0.875rem",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            color: "var(--color-primary, #b78a3c)",
            fontWeight: 600,
            marginBottom: "12px",
          }}
        >
          404 — Not Found
        </p>

        <h1
          style={{
            fontSize: "clamp(2rem, 4vw, 3rem)",
            fontFamily: "var(--font-serif, serif)",
            fontWeight: 400,
            marginBottom: "16px",
            color: "var(--color-text)",
          }}
        >
          This Piece Could Not Be Found
        </h1>

        <p
          style={{
            maxWidth: "480px",
            margin: "0 auto 32px",
            color: "var(--color-text-muted)",
            fontSize: "1rem",
            lineHeight: 1.6,
          }}
        >
          The page or jewellery design you are looking for may have moved, been renamed, or is currently unavailable.
        </p>

        <div
          style={{
            display: "flex",
            gap: "16px",
            flexWrap: "wrap",
            justifyContent: "center",
            marginBottom: "48px",
          }}
        >
          <Button href="/" variant="primary">
            Return Home
          </Button>
          <Button href="/all-products/rings" variant="secondary">
            Explore Jewellery
          </Button>
          <Button href={WHATSAPP_URL} variant="ghost">
            Chat with Concierge →
          </Button>
        </div>

        <div
          style={{
            borderTop: "1px solid var(--color-border-light)",
            paddingTop: "32px",
            width: "100%",
            maxWidth: "600px",
          }}
        >
          <p
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--color-text-muted)",
              marginBottom: "16px",
            }}
          >
            Popular Categories
          </p>
          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {STOCKED_CATEGORIES.map((slug) => (
              <Link
                key={slug}
                href={`/all-products/${slug}`}
                style={{
                  padding: "8px 16px",
                  borderRadius: "var(--radius-full, 9999px)",
                  border: "1px solid var(--color-border)",
                  fontSize: "0.875rem",
                  color: "var(--color-text)",
                  backgroundColor: "var(--bg-card)",
                  textDecoration: "none",
                  transition: "background-color 0.15s ease",
                }}
              >
                {CATEGORY_LABELS[slug].title}
              </Link>
            ))}
          </div>
        </div>
      </main>
    </PageShell>
  );
}
