import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

/**
 * Transactional email — best-effort, never blocks a payment/order flow.
 * Uses Resend (RESEND_API_KEY in env); absent key = silently skipped.
 * All templates share the branded wrapper below (serif, gold accents,
 * light/dark-mail safe).
 */

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = process.env.EMAIL_FROM ?? "VAIRIS <orders@thevairis.com>";
const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "";

/** Branded shell shared by every transactional email. */
function emailShell(title: string, bodyHtml: string): string {
  return `
  <div style="background:#f5f2ec;padding:24px 12px;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #eae4d8">
      <div style="background:#5e684e;padding:20px;text-align:center">
        <span style="color:#f5f2ec;font-size:20px;letter-spacing:6px">VAIRIS</span>
      </div>
      <div style="padding:28px 24px">
        <h1 style="font-size:19px;font-weight:600;margin:0 0 16px">${title}</h1>
        ${bodyHtml}
      </div>
      <div style="padding:16px 24px;border-top:1px solid #eae4d8;font-size:11px;color:#8a8577;text-align:center">
        IGI Certified · BIS Hallmarked · Insured Delivery<br/>
        © 2026 VAIRIS · <a href="${APP_URL()}" style="color:#8a8577">thevairis.com</a>
      </div>
    </div>
  </div>`;
}

const btn = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#5e684e;color:#f5f2ec;text-decoration:none;padding:11px 22px;border-radius:6px;font-size:14px;margin:12px 0">${label}</a>`;

export async function sendOrderConfirmationEmail(orderId: string): Promise<void> {
  try {
    const resend = getResend();
    if (!resend) return; // email not configured — silently skip, never block checkout

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        user: { select: { email: true, name: true } },
        children: { include: { items: true } },
      },
    });
    if (!order) return;

    // Split parents move their line items to children in the same
    // transaction that confirms the order (lib/split.ts) — by the time this
    // fire-and-forget email fetch runs, order.items is empty. Fall back to
    // the combined item list across children so the receipt still shows
    // every piece the customer bought.
    const receiptItems =
      order.items.length > 0
        ? order.items
        : order.children.flatMap((c) => c.items);

    const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
    const rows = receiptItems
      .map(
        (i) =>
          `<tr><td style="padding:6px 0">${i.productName} × ${i.quantity}${i.withExchange ? " (with exchange)" : ""}</td><td align="right">${inr(Number(i.price) * i.quantity)}</td></tr>`,
      )
      .join("");

    // Legacy deposit-model orders only — new orders have depositAmount = 0.
    const deposit = Number(order.depositAmount);
    const depositRow =
      deposit > 0
        ? `<tr><td style="padding:6px 0">Refundable security deposit</td><td align="right">${inr(deposit)}</td></tr>`
        : "";
    const depositNote =
      deposit > 0
        ? `<p style="font-size:13px;color:#555">Your ${inr(deposit)} security deposit is refunded to your payment method after delivery.</p>`
        : "";

    await resend.emails.send({
      from: FROM,
      to: order.user.email,
      subject: `Order confirmed — ${order.id}`,
      html: emailShell(
        "Your order is confirmed",
        `
          <p style="font-size:14px;line-height:1.6">Hi ${order.user.name},</p>
          <p style="font-size:14px;line-height:1.6">Thank you for trusting VAIRIS. Your order <strong>${order.id}</strong> is confirmed and our craftsmen are on it.</p>
          <table width="100%" style="border-top:1px solid #eae4d8;border-bottom:1px solid #eae4d8;margin:16px 0;font-size:13px">
            ${rows}
            ${depositRow}
            <tr><td style="padding:8px 0"><strong>Paid</strong></td><td align="right"><strong>${inr(Number(order.grandTotal))}</strong></td></tr>
          </table>
          ${depositNote}
          ${btn(`${APP_URL()}/account/orders/${order.id}`, "Track Your Order")}
        `,
      ),
    });
  } catch (err) {
    // Best-effort by design — log and move on.
    console.error("sendOrderConfirmationEmail failed", err);
  }
}

/** Shipped — includes courier + AWB + tracking link. */
export async function sendOrderShippedEmail(orderId: string): Promise<void> {
  try {
    const resend = getResend();
    if (!resend) return;
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { email: true, name: true } },
        shipments: { orderBy: { dispatchedAt: "desc" }, take: 1 },
      },
    });
    if (!order) return;
    const shipment = order.shipments[0];

    await resend.emails.send({
      from: FROM,
      to: order.user.email,
      subject: `Your VAIRIS order is on its way — ${order.id}`,
      html: emailShell(
        "Your jewellery has shipped ✨",
        `
          <p style="font-size:14px;line-height:1.6">Hi ${order.user.name},</p>
          <p style="font-size:14px;line-height:1.6">Your order <strong>${order.id}</strong> is on its way in insured, tamper-proof packaging. Delivery is OTP-protected.</p>
          ${
            shipment
              ? `<p style="font-size:13px;line-height:1.7;background:#f8f6f1;border-radius:8px;padding:12px 14px">
                   Courier: <strong>${shipment.courierName ?? "—"}</strong><br/>
                   AWB / Tracking no.: <strong>${shipment.awbCode ?? "—"}</strong>
                   ${shipment.trackingUrl ? `<br/><a href="${shipment.trackingUrl}" style="color:#5e684e">Live courier tracking ↗</a>` : ""}
                 </p>`
              : ""
          }
          ${btn(`${APP_URL()}/account/orders/${order.id}`, "Track Your Order")}
        `,
      ),
    });
  } catch (err) {
    console.error("sendOrderShippedEmail failed", err);
  }
}

/** Delivered — thank-you + review request. */
export async function sendOrderDeliveredEmail(orderId: string): Promise<void> {
  try {
    const resend = getResend();
    if (!resend) return;
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { email: true, name: true } },
        items: { include: { variant: { select: { productId: true } } } },
      },
    });
    if (!order) return;
    const firstProductId = order.items[0]?.variant.productId;

    await resend.emails.send({
      from: FROM,
      to: order.user.email,
      subject: `Delivered — we hope you love it`,
      html: emailShell(
        "Your VAIRIS piece has arrived",
        `
          <p style="font-size:14px;line-height:1.6">Hi ${order.user.name},</p>
          <p style="font-size:14px;line-height:1.6">Order <strong>${order.id}</strong> has been delivered. Wear it well — and often.</p>
          <p style="font-size:14px;line-height:1.6">When you have a minute, we'd love to hear how it feels. Your review helps other women find their everyday sparkle.</p>
          ${firstProductId ? btn(`${APP_URL()}/product/${firstProductId}#reviews`, "Write a Review") : ""}
          <p style="font-size:12px;color:#8a8577;line-height:1.6">Care tip: wipe gently with a soft cloth after wearing; avoid perfume sprays directly on the piece.</p>
        `,
      ),
    });
  } catch (err) {
    console.error("sendOrderDeliveredEmail failed", err);
  }
}
