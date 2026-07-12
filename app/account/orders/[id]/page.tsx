import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { OrderSummary } from "@/components/commerce/OrderSummary";
import { OrderStatusChip, OrderTimeline } from "@/components/commerce/OrderTimeline";
import { RetryPaymentButton } from "./RetryPaymentButton";
import { ReturnRequestButton } from "./ReturnRequestButton";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pageLayouts } from "@/lib/layout-config";
import { formatPrice } from "@/lib/ui-data";

export const dynamic = "force-dynamic";

/**
 * Return eligibility (customer-facing "Easy Returns"): standalone orders and
 * split children each have their own delivery/deposit, so this is computed
 * per-order — a split parent's own status is SPLIT_INTO_DELIVERIES, never
 * DELIVERED/DEPOSIT_REFUNDED, so it naturally never qualifies. Kept as a
 * plain helper (not inline in the component body) since it reads the clock.
 */
function computeReturnEligibility(
  status: string,
  events: { status: string; createdAt: Date }[],
): { returnEligibleUntil: Date | null; canRequestReturn: boolean } {
  const returnWindowDays = Number(process.env.RETURN_WINDOW_DAYS ?? 7);
  const deliveredEvent = [...events].reverse().find((e) => e.status === "DELIVERED");
  const returnEligibleUntil = deliveredEvent
    ? new Date(deliveredEvent.createdAt.getTime() + returnWindowDays * 86400_000)
    : null;
  const canRequestReturn =
    (status === "DELIVERED" || status === "DEPOSIT_REFUNDED") &&
    !!returnEligibleUntil &&
    Date.now() <= returnEligibleUntil.getTime();
  return { returnEligibleUntil, canRequestReturn };
}

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
      parent: { select: { id: true } },
      children: {
        include: {
          items: true,
          events: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!order || order.user.email !== session.user.email) notFound();

  const deposit = Number(order.depositAmount);
  const shipment = order.shipments[0] ?? null;
  const refunded = Number(order.payment?.refundedAmount ?? 0);
  const isSplitParent = order.status === "SPLIT_INTO_DELIVERIES" && order.children.length > 0;
  const { returnEligibleUntil, canRequestReturn } = computeReturnEligibility(order.status, order.events);

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
              {order.status === "PAYMENT_PENDING" && <RetryPaymentButton orderId={order.id} />}
              {canRequestReturn && returnEligibleUntil && (
                <ReturnRequestButton
                  orderId={order.id}
                  eligibleUntil={returnEligibleUntil.toISOString()}
                />
              )}

              <section className="confirm-card">
                <h3 className="confirm-card__heading">Order Journey</h3>
                <OrderTimeline status={order.status} events={order.events} />
              </section>

              {isSplitParent && (
                <section className="confirm-card">
                  <h3 className="confirm-card__heading">
                    {order.children.length} Deliveries
                  </h3>
                  <div className="order-deliveries">
                    {order.children.map((child, i) => (
                      <div key={child.id} className="order-deliveries__item">
                        <div className="order-deliveries__head">
                          <strong>Delivery {i + 1} of {order.children.length}</strong>
                          <OrderStatusChip status={child.status} />
                        </div>
                        <p className="checkout-note">
                          {child.items.map((item) => item.productName).join(", ")}
                        </p>
                        <OrderTimeline status={child.status} events={child.events} />
                        <p>
                          <Link href={`/account/orders/${child.id}`}>
                            View delivery {i + 1} →
                          </Link>
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

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
                // Split parents moved their items to children — the combined
                // receipt lists every child's items (see lib/split.ts).
                ...(isSplitParent ? order.children.flatMap((c) => c.items) : order.items).map(
                  (item) => ({
                    label: `${item.productName} × ${item.quantity}`,
                    value: formatPrice(Number(item.price) * item.quantity),
                  }),
                ),
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
