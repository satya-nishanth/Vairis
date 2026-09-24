import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { OrderStatusChip } from "@/components/commerce/OrderTimeline";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pageLayouts } from "@/lib/layout-config";
import { formatPrice } from "@/lib/ui-data";

export const dynamic = "force-dynamic";

/** My Orders — the customer's order history. */
export default async function OrdersPage() {
  const session = await getSession();
  if (!session) redirect("/auth/login?next=/account/orders");

  const orders = await prisma.order.findMany({
    where: { user: { email: session.user.email! } },
    include: { items: true, children: { include: { items: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <PageShell
      {...pageLayouts.contact}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "My Account", href: "/account" },
        { label: "My Orders" },
      ]}
    >
      <Container>
        <div className="orders-page">
          <h1 className="orders-page__title">My Orders</h1>

          {orders.length === 0 ? (
            <div className="cart-state">
              <p>No orders yet — your online purchases will appear here.</p>
              <p style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", marginTop: "8px", marginBottom: "20px", maxWidth: "440px", marginInline: "auto" }}>
                Ordered through WhatsApp or a bespoke quotation? Our concierge links purchases to your phone number and email. Track your order with your order ID or reach out on WhatsApp.
              </p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                <Link href="/all-products/rings" className="btn btn-primary">
                  Start Shopping
                </Link>
                <Link href="/track-order" className="btn btn-secondary">
                  Track Order
                </Link>
              </div>
            </div>
          ) : (
            <ul className="orders-list">
              {orders.map((order) => {
                // Split parents move their line items to children, so the
                // parent's own item list is empty — show the deliveries
                // instead of an amount (see lib/split.ts).
                const isSplitParent = order.status === "SPLIT_INTO_DELIVERIES" && order.children.length > 0;
                const displayItems = isSplitParent
                  ? order.children.flatMap((c) => c.items)
                  : order.items;
                return (
                  <li key={order.id}>
                    <Link href={`/account/orders/${order.id}`} className="orders-list__card">
                      <div className="orders-list__main">
                        <strong>
                          {displayItems.map((i) => i.productName).join(", ") || "Order"}
                        </strong>
                        <span className="orders-list__meta">
                          {order.id} ·{" "}
                          {order.createdAt.toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <div className="orders-list__side">
                        <OrderStatusChip status={order.status} />
                        {isSplitParent ? (
                          <span className="orders-list__amount">
                            {order.children.length} deliveries
                          </span>
                        ) : (
                          <span className="orders-list__amount">
                            {formatPrice(Number(order.grandTotal))}
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Container>
    </PageShell>
  );
}
