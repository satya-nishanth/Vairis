/**
 * End-to-end order lifecycle test — runs WITHOUT real Razorpay keys.
 *
 * Real-key-dependent step (gateway payment intent creation) is bypassed by
 * seeding the Order/Payment rows directly; everything downstream — webhook
 * capture, admin transitions, shipping entry, deposit refund webhook,
 * customer pages — is exercised through the real HTTP surface:
 *
 *   1. checkout: 503 not-configured (no keys) OR 200 + intent (keys present)
 *   2. seed PAYMENT_PENDING order + CREATED payment (as /api/checkout would)
 *   3. webhook payment.captured (HMAC-signed) → PAYMENT_CONFIRMED, cart cleared
 *   4. duplicate webhook delivery → idempotent no-op
 *   5. bad webhook signature → 400
 *   6. admin: PREPARING → SHIPPED (courier+AWB required) → DELIVERED
 *   7. refund: 503 not-configured (no keys) OR 502 gateway-refused (keys + simulated payment id)
 *   8. webhook refund.processed (5%) → DEPOSIT_REFUNDED, PARTIALLY_REFUNDED
 *   9. customer surfaces: /account/orders, order detail, /track-order API
 */
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const EMAIL = "nish99.sn@gmail.com";
const PASSWORD = "Admin1234!";
const prisma = new PrismaClient();

const envFile = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const WEBHOOK_SECRET = envFile.match(/^RAZORPAY_WEBHOOK_SECRET=(.+)$/m)?.[1]?.trim();
// Gateway-aware: with real test keys in .env.local the "not configured" 503
// paths don't exist — those steps assert the configured behavior instead.
const GATEWAY_CONFIGURED = Boolean(envFile.match(/^RAZORPAY_KEY_ID=(.+)$/m)?.[1]?.trim());
if (!WEBHOOK_SECRET) throw new Error("RAZORPAY_WEBHOOK_SECRET missing from .env.local");

let pass = 0;
let fail = 0;
const step = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

function signedWebhook(body) {
  const raw = JSON.stringify(body);
  return {
    raw,
    signature: crypto.createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex"),
  };
}

async function postWebhook(body, sig) {
  const { raw, signature } = signedWebhook(body);
  return fetch(`${BASE}/api/webhooks/payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-razorpay-signature": sig ?? signature },
    body: raw,
  });
}

// ── Browser session (customer + admin are the same test user) ──
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/auth/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', EMAIL);
await page.fill('input[name="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 20000 });

const api = (path, init) => page.evaluate(
  async ({ path, init }) => {
    const res = await fetch(path, init);
    let body = null;
    try { body = await res.json(); } catch {}
    return { status: res.status, body };
  },
  { path, init },
);

// ── 1. checkout without gateway keys → 503 ──
{
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  const variant = await prisma.productVariant.findFirst({ where: { product: { isActive: true } } });
  await prisma.cartItem.upsert({
    where: { userId_variantId: { userId: user.id, variantId: variant.id } },
    update: { quantity: 1 },
    create: { userId: user.id, variantId: variant.id, quantity: 1 },
  });

  const res = await api("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contactName: "Test Buyer",
      contactPhone: "9876543210",
      addressLine1: "12 MG Road",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
    }),
  });
  if (GATEWAY_CONFIGURED) {
    step(
      "checkout with keys → 200 + gateway intent",
      res.status === 200 && !!res.body?.clientParams && !!res.body?.orderId,
      `status ${res.status}`,
    );
    // clean up the real PAYMENT_PENDING order this created
    if (res.body?.orderId) {
      await prisma.payment.deleteMany({ where: { orderId: res.body.orderId } });
      await prisma.orderEvent.deleteMany({ where: { orderId: res.body.orderId } });
      await prisma.orderItem.deleteMany({ where: { orderId: res.body.orderId } });
      await prisma.order.delete({ where: { id: res.body.orderId } }).catch(() => {});
    }
  } else {
    step(
      "checkout without keys → 503 PAYMENTS_NOT_CONFIGURED",
      res.status === 503 && res.body?.error === "PAYMENTS_NOT_CONFIGURED",
      `status ${res.status}`,
    );
  }
}

// ── 2. seed order + payment exactly as /api/checkout would ──
const user = await prisma.user.findUnique({ where: { email: EMAIL } });
const variant = await prisma.productVariant.findFirst({ where: { product: { isActive: true } }, include: { product: true } });
const total = 20000;
const grandTotal = Math.round(total * 1.05);
const gwOrderId = `order_SIM${Date.now()}`;
const gwPaymentId = `pay_SIM${Date.now()}`;

const order = await prisma.order.create({
  data: {
    userId: user.id,
    status: "PAYMENT_PENDING",
    totalAmount: total,
    depositAmount: grandTotal - total,
    grandTotal,
    contactName: "Test Buyer",
    contactPhone: "9876543210",
    addressLine1: "12 MG Road",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
    items: { create: { variantId: variant.id, quantity: 1, price: total, productName: variant.product.name } },
    events: { create: { status: "PAYMENT_PENDING", note: "Order created" } },
  },
});
await prisma.payment.create({
  data: { orderId: order.id, razorpayOrderId: gwOrderId, status: "CREATED", amount: grandTotal },
});
console.log(`      seeded order ${order.id}`);

// ── 3. payment.captured webhook → confirmed + cart cleared ──
{
  const res = await postWebhook({
    event: "payment.captured",
    payload: { payment: { entity: { id: gwPaymentId, order_id: gwOrderId } } },
  });
  const after = await prisma.order.findUnique({ where: { id: order.id }, include: { payment: true } });
  const cartCount = await prisma.cartItem.count({ where: { userId: user.id } });
  step(
    "payment.captured → PAYMENT_CONFIRMED + CAPTURED + cart cleared",
    res.status === 200 && after.status === "PAYMENT_CONFIRMED" && after.payment.status === "CAPTURED" && cartCount === 0,
    `order=${after.status} payment=${after.payment.status} cart=${cartCount}`,
  );
}

// ── 4. duplicate delivery → idempotent ──
{
  await postWebhook({
    event: "payment.captured",
    payload: { payment: { entity: { id: gwPaymentId, order_id: gwOrderId } } },
  });
  const events = await prisma.orderEvent.count({ where: { orderId: order.id, status: "PAYMENT_CONFIRMED" } });
  step("duplicate payment.captured is idempotent", events === 1, `${events} confirmation event(s)`);
}

// ── 5. bad signature → 400 ──
{
  const res = await postWebhook(
    { event: "payment.captured", payload: { payment: { entity: { id: "x", order_id: "y" } } } },
    "deadbeef".repeat(8),
  );
  step("tampered webhook signature rejected", res.status === 400, `status ${res.status}`);
}

// ── 6. admin transitions ──
{
  let res = await api(`/api/admin/orders/${order.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "SHIPPED" }),
  });
  step("PAYMENT_CONFIRMED → SHIPPED blocked (must process first)", res.status === 409, `status ${res.status}`);

  res = await api(`/api/admin/orders/${order.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "PREPARING" }),
  });
  step("→ PREPARING", res.status === 200, `status ${res.status}`);

  res = await api(`/api/admin/orders/${order.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "SHIPPED" }),
  });
  step("SHIPPED without courier/AWB rejected", res.status === 400, `status ${res.status}`);

  res = await api(`/api/admin/orders/${order.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: "SHIPPED",
      courierName: "BlueDart",
      awbCode: "BD123456789",
      trackingUrl: "https://bluedart.com/track/BD123456789",
    }),
  });
  const shipment = await prisma.shipment.findFirst({
    where: { orderId: order.id },
    orderBy: { dispatchedAt: "desc" },
  });
  step("→ SHIPPED with manual courier details", res.status === 200 && shipment?.awbCode === "BD123456789");

  res = await api(`/api/admin/orders/${order.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "DELIVERED" }),
  });
  step("→ DELIVERED", res.status === 200, `status ${res.status}`);
}

// ── 7. refund API without gateway keys → 503 ──
{
  const res = await api(`/api/admin/orders/${order.id}/refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "deposit" }),
  });
  if (GATEWAY_CONFIGURED) {
    // pay_SIM… doesn't exist at the gateway → our API surfaces 502 (gateway refused)
    step("refund on simulated payment → 502 (gateway refused)", res.status === 502, `status ${res.status}`);
  } else {
    step("refund initiation without keys → 503 (not-configured path)", res.status === 503, `status ${res.status}`);
  }
}

// ── 8. refund.processed webhook (5% deposit) → DEPOSIT_REFUNDED ──
{
  const res = await postWebhook({
    event: "refund.processed",
    payload: {
      refund: { entity: { id: `rfnd_SIM${Date.now()}`, payment_id: gwPaymentId, amount: (grandTotal - total) * 100 } },
    },
  });
  const after = await prisma.order.findUnique({ where: { id: order.id }, include: { payment: true } });
  step(
    "refund.processed (deposit) → DEPOSIT_REFUNDED + PARTIALLY_REFUNDED",
    res.status === 200 && after.status === "DEPOSIT_REFUNDED" && after.payment.status === "PARTIALLY_REFUNDED",
    `order=${after.status} payment=${after.payment.status} refunded=${after.payment.refundedAmount}`,
  );
}

// ── 9. customer surfaces ──
{
  await page.goto(`${BASE}/account/orders`, { waitUntil: "networkidle" });
  const listed = await page.locator(`a[href="/account/orders/${order.id}"]`).count();
  step("order listed on /account/orders", listed === 1);

  await page.goto(`${BASE}/account/orders/${order.id}`, { waitUntil: "networkidle" });
  const body = await page.textContent("body");
  step(
    "order detail shows timeline + deposit + AWB",
    body.includes("Deposit Refunded") && body.includes("BD123456789") && body.includes("Security Deposit"),
  );
  await page.screenshot({ path: `${process.env.SHOTS_DIR ?? "/tmp"}/order-detail.png`, fullPage: true });

  const track = await api("/api/track-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: order.id, email: EMAIL }),
  });
  step(
    "public track-order lookup",
    track.status === 200 && track.body?.status === "DEPOSIT_REFUNDED" && track.body?.shipment?.awbCode === "BD123456789",
  );

  const trackBad = await api("/api/track-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: order.id, email: "wrong@example.com" }),
  });
  step("track-order with wrong email → 404", trackBad.status === 404, `status ${trackBad.status}`);
}

// ── cleanup ──
await prisma.orderEvent.deleteMany({ where: { orderId: order.id } });
await prisma.shipment.deleteMany({ where: { orderId: order.id } });
await prisma.payment.deleteMany({ where: { orderId: order.id } });
await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
await prisma.order.delete({ where: { id: order.id } });
console.log("      cleaned up test order");

await browser.close();
await prisma.$disconnect();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
