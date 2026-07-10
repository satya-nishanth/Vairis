import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

/**
 * Transactional email — best-effort, never blocks a payment/order flow.
 * Uses Resend (already configured per project docs; RESEND_API_KEY in env).
 *
 * Template is intentionally minimal — the P8 "email template redesign"
 * roadmap item replaces the HTML here, nothing else changes.
 */

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = process.env.EMAIL_FROM ?? "VAIRIS <orders@thevairis.com>";

export async function sendOrderConfirmationEmail(orderId: string): Promise<void> {
  try {
    const resend = getResend();
    if (!resend) return; // email not configured — silently skip, never block checkout

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true, user: { select: { email: true, name: true } } },
    });
    if (!order) return;

    const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
    const rows = order.items
      .map(
        (i) =>
          `<tr><td style="padding:6px 0">${i.productName} × ${i.quantity}</td><td align="right">${inr(Number(i.price) * i.quantity)}</td></tr>`,
      )
      .join("");

    await resend.emails.send({
      from: FROM,
      to: order.user.email,
      subject: `Order confirmed — ${order.id}`,
      html: `
        <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1a1a1a">
          <h2 style="letter-spacing:2px">VAIRIS</h2>
          <p>Hi ${order.user.name},</p>
          <p>Your order <strong>${order.id}</strong> is confirmed. Thank you for trusting Vairis.</p>
          <table width="100%" style="border-top:1px solid #ddd;border-bottom:1px solid #ddd;margin:16px 0">
            ${rows}
            <tr><td style="padding:6px 0">Refundable security deposit (5%)</td><td align="right">${inr(Number(order.depositAmount))}</td></tr>
            <tr><td style="padding:6px 0"><strong>Paid</strong></td><td align="right"><strong>${inr(Number(order.grandTotal))}</strong></td></tr>
          </table>
          <p style="font-size:13px;color:#555">Your ${inr(Number(order.depositAmount))} security deposit is refunded to your payment method after delivery.</p>
          <p style="font-size:13px;color:#555">Track your order anytime: ${process.env.NEXT_PUBLIC_APP_URL ?? ""}/account/orders/${order.id}</p>
        </div>
      `,
    });
  } catch (err) {
    // Best-effort by design — log and move on.
    console.error("sendOrderConfirmationEmail failed", err);
  }
}
