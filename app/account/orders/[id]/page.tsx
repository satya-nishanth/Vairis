import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { OrderSummary } from "@/components/commerce/OrderSummary";
import { OrderStatusChip, OrderTimeline } from "@/components/commerce/OrderTimeline";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pageLayouts } from "@/lib/layout-config";
import { formatPrice } from "@/lib/ui-data";

export const dynamic = "force-dynamic";

/**
 * Order detail — items, 105%/5% money breakdown, status timeline, shipment.
 *
 * Shipment block: delivery partner is not integrated yet (lib/shipping,
 * manual provider) — courier/AWB/tracking URL are whatever admin entered
 * when marking the order shipped. When a partner API lands, live tracking
 * events from provider.trackShipment() slot in below the same block.
 */
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/auth/login?next=/account/orders/${id}`);

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      shipments: { orderBy: { dispatchedAt: "desc" } },
      payment: true,
      events: { orderBy: { createdAt: "asc" } },
      user: { select: { email: true } },
    },
  });
  if (!order || order.user.email !== session.user.email) notFound();

  const deposit = Number(order.depositAmount);
  const shipment = order.shipments[0] ?? null;
  const refunded = Number(order.payment?.refundedAmount ?? 0);

  return (
    <PageShell {...pageLayouts.contact}>
      <Container>
        <div className="orders-page">
          <p className="orders-page__back">
            <Link href="/account/orders">← My Orders</Link>
          </p>
          <div className="order-detail__head">
            <h1 className="orders-page__title">Order {order.id}</h1>
            <OrderStatusChip status={order.status} />
          </div>

          <div className="order-detail__layout">
            <div>
              <section className="confirm-card">
                <h3 className="confirm-card__heading">Order Journey</h3>
                <OrderTimeline status={order.status} events={order.events} />
              </section>

              {shipment && (
                <section className="confirm-card">
                  <h3 className="confirm-card__heading">Shipment</h3>
                  <dl>
                    <dt>Courier</dt>
                    <dd>{shipment.courierName ?? "—"}</dd>
                    <dt>AWB / Tracking No.</dt>
                    <dd>{shipment.awbCode ?? "—"}</dd>
                    {shipment.trackingUrl && (
                      <>
                        <dt>Live Tracking</dt>
                        <dd>
                          <a
                            href={shipment.trackingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Track with courier ↗
                          </a>
                        </dd>
                      </>
                    )}
                  </dl>
                </section>
              )}

              <section className="confirm-card">
                <h3 className="confirm-card__heading">Security Deposit</h3>
                <p className="checkout-note">
                  {refunded > 0
                    ? `${formatPrice(refunded)} refunded to your payment method.`
                    : `${formatPrice(deposit)} will be refunded to your payment method after delivery.`}
                </p>
              </section>

              <section className="confirm-card">
                <h3 className="confirm-card__heading">Delivery Address</h3>
                <p className="checkout-note">
                  {order.contactName} · {order.contactPhone}
                  <br />
                  {order.addressLine1}
                  {order.addressLine2 ? `, ${order.addressLine2}` : ""}, {order.city},{" "}
                  {order.state} — {order.pincode}
                </p>
              </section>
            </div>

            <OrderSummary
              title="Payment Summary"
              lines={[
                ...order.items.map((item) => ({
                  label: `${item.productName} × ${item.quantity}`,
                  value: formatPrice(Number(item.price) * item.quantity),
                })),
                { label: "Refundable deposit (5%)", value: formatPrice(deposit) },
                { label: "Shipping", value: "FREE" },
                ...(refunded > 0
                  ? [{ label: "Refunded", value: `− ${formatPrice(refunded)}` }]
                  : []),
              ]}
              total={Number(order.grandTotal)}
              totalLabel="Paid"
            />
          </div>
        </div>
      </Container>
    </PageShell>
  );
}
