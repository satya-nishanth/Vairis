import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { OrderSummary } from "@/components/commerce/OrderSummary";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { pageLayouts } from "@/lib/layout-config";
import { formatPrice } from "@/lib/ui-data";
import { CopyOrderButton } from "./CopyOrderButton";

export const dynamic = "force-dynamic";

/**
 * Order confirmation — real order data via ?orderId=.
 * Reached from the checkout success handler; safe to refresh/revisit
 * (server fetch by id + ownership check, no client state).
 *
 * A PAYMENT_PENDING order renders the "payment pending" variant — the customer paid
 * but the capture webhook/verify hasn't landed yet (usually seconds).
 */
export default async function OrderConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const layout = pageLayouts.confirmation;
  const { orderId } = await searchParams;
  if (!orderId) redirect("/account/orders");

  const session = await getSession();
  if (!session) redirect(`/auth/login?next=${encodeURIComponent(`/order-confirmation?orderId=${orderId}`)}`);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, user: { select: { email: true } } },
  });
  if (!order || order.user.email !== session.user.email) redirect("/account/orders");

  const paymentPending = order.status === "PAYMENT_PENDING";
  const deposit = Number(order.depositAmount);

  return (
    <PageShell {...layout}>
      <Container>
        <div className="confirm-layout">
          <div>
            <div className="confirm-success">
              <div className="confirm-success__icon">{paymentPending ? "⏳" : "✓"}</div>
              <div>
                <h1 className="confirm-success__title">
                  {paymentPending ? "Payment Pending" : "Order Confirmed!"}
                </h1>
                <p>
                  {paymentPending
                    ? "We're waiting for your payment to be confirmed — this usually takes under a minute. Refresh this page or check My Orders."
                    : "Thank you! Your order has been successfully placed."}
                </p>
              </div>
            </div>

            <div className="confirm-card">
              <dl>
                <dt>Order ID</dt>
                <dd>
                  {order.id} <CopyOrderButton orderId={order.id} />
                </dd>
                <dt>Placed</dt>
                <dd>
                  {order.createdAt.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </dd>
                <dt>Deliver to</dt>
                <dd>
                  {order.contactName} · {order.contactPhone}
                  <br />
                  {order.addressLine1}
                  {order.addressLine2 ? `, ${order.addressLine2}` : ""}, {order.city}, {order.state}{" "}
                  — {order.pincode}
                </dd>
              </dl>
            </div>

            <div className="confirm-card">
              <h3 className="confirm-card__heading">Your 5% security deposit</h3>
              <p className="checkout-note">
                {formatPrice(deposit)} of your payment is a refundable security deposit — it is
                returned to your payment method after delivery. You can follow it on the order
                page.
              </p>
            </div>

            <section className="what-next">
              {[
                ["🔍", "Quality Check", "Every piece is inspected before dispatch."],
                ["🚚", "Insured Dispatch", "Tracked, tamper-proof shipping."],
                ["📦", "Delivered", "OTP-protected handover."],
                ["💎", "Deposit Back", `${formatPrice(deposit)} refunded after delivery.`],
              ].map(([icon, title, desc]) => (
                <div key={title}>
                  <div className="what-next__icon">{icon}</div>
                  <h4>{title}</h4>
                  <p>{desc}</p>
                </div>
              ))}
            </section>

            <p className="confirm-actions">
              <Link href={`/account/orders/${order.id}`} className="btn btn-primary">
                Track This Order
              </Link>{" "}
              <Link href="/all-products/rings" className="btn btn-secondary">
                Continue Shopping
              </Link>
            </p>
          </div>

          <OrderSummary
            title="Order Summary"
            lines={[
              ...order.items.map((item) => ({
                label: `${item.productName} × ${item.quantity}`,
                value: formatPrice(Number(item.price) * item.quantity),
              })),
              { label: "Refundable deposit (5%)", value: formatPrice(deposit) },
              { label: "Shipping", value: "FREE" },
            ]}
            total={Number(order.grandTotal)}
            totalLabel={paymentPending ? "Payable" : "Paid"}
            footer={
              <p className="summary-badges">
                {formatPrice(deposit)} refunded after delivery · IGI · BIS · Insured
              </p>
            }
          />
        </div>
      </Container>
    </PageShell>
  );
}
