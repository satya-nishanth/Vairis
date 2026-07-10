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
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <PageShell {...pageLayouts.contact}>
      <Container>
        <div className="orders-page">
          <h1 className="orders-page__title">My Orders</h1>

          {orders.length === 0 ? (
            <div className="cart-state">
              <p>No orders yet — your purchases will appear here.</p>
              <Link href="/all-products/rings" className="btn btn-primary">
                Start Shopping
              </Link>
            </div>
          ) : (
            <ul className="orders-list">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link href={`/account/orders/${order.id}`} className="orders-list__card">
                    <div className="orders-list__main">
                      <strong>
                        {order.items.map((i) => i.productName).join(", ") || "Order"}
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
                      <span className="orders-list__amount">
                        {formatPrice(Number(order.grandTotal))}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </PageShell>
  );
}
