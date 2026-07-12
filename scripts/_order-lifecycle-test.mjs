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
 *   8. ledger-matched refund.processed webhook (5% deposit) → DEPOSIT_REFUNDED; duplicate delivery idempotent
 *   9. sweep expires a stale PAYMENT_PENDING order; late capture on it never resurrects (auto-refund alert)
 *   10. customer surfaces: /account/orders, order detail, /track-order API
 *   11. auto-split: manual multi-item order (POST /api/admin/orders) → children created atomically,
 *       proration exact (traced 10001/20003/30007 by hand); single-item manual order stays unsplit
 *   12. auto-split: online checkout multi-item order → payment.captured splits atomically with
 *       confirmation; child refund resolves the parent's payment; customer/admin/track-order rendering
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
    body: JSON.stringify({ kind: "deposit", reason: "test deposit refund" }),
  });
  if (GATEWAY_CONFIGURED) {
    // pay_SIM… doesn't exist at the gateway → our API surfaces 502 (gateway refused)
    step("refund on simulated payment → 502 (gateway refused)", res.status === 502, `status ${res.status}`);
  } else {
    step("refund initiation without keys → 503 (not-configured path)", res.status === 503, `status ${res.status}`);
  }
}

// ── 8. ledger-matched refund webhook ──
{
  const refundId = `rfnd_LEDGER${Date.now()}`;
  await prisma.orderRefund.create({
    data: { orderId: order.id, amount: grandTotal - total, kind: "DEPOSIT", method: "GATEWAY", gatewayRefundId: refundId, reason: "test deposit", status: "INITIATED" },
  });
  const res = await postWebhook({
    event: "refund.processed",
    payload: { refund: { entity: { id: refundId, payment_id: gwPaymentId, amount: (grandTotal - total) * 100 } } },
  });
  const after = await prisma.order.findUnique({ where: { id: order.id } });
  const row = await prisma.orderRefund.findUnique({ where: { gatewayRefundId: refundId } });
  step("refund.processed matches ledger intent", res.status === 200 && after.status === "DEPOSIT_REFUNDED" && row.status === "COMPLETED");
  // duplicate delivery is a no-op
  await postWebhook({
    event: "refund.processed",
    payload: { refund: { entity: { id: refundId, payment_id: gwPaymentId, amount: (grandTotal - total) * 100 } } },
  });
  const events = await prisma.orderEvent.count({ where: { orderId: order.id, status: "DEPOSIT_REFUNDED" } });
  step("duplicate refund webhook idempotent", events === 1);
}

// ── 9. sweep + late capture ──
{
  const old = await prisma.order.create({
    data: {
      userId: user.id,
      status: "PAYMENT_PENDING",
      totalAmount: 1000,
      depositAmount: 50,
      grandTotal: 1050,
      contactName: "x",
      contactPhone: "9999999999",
      addressLine1: "a street 1",
      city: "B",
      state: "K",
      pincode: "560001",
      createdAt: new Date(Date.now() - 30 * 3600_000),
      events: { create: { status: "PAYMENT_PENDING", note: "seed" } },
    },
  });
  const oldGw = `order_SWEEP${Date.now()}`;
  await prisma.payment.create({ data: { orderId: old.id, razorpayOrderId: oldGw, status: "CREATED", amount: 1050 } });
  const res = await fetch(`${BASE}/api/admin/sweep-orders`, {
    method: "POST",
    headers: { Authorization: "Bearer dev-local-sweep-secret" },
  });
  const after = await prisma.order.findUnique({ where: { id: old.id } });
  step("sweep expires stale unpaid order", res.status === 200 && after.status === "PAYMENT_EXPIRED");

  // a stale order whose payment already CAPTURED must survive the sweep —
  // this is what the race fix in sweep-orders/route.ts protects
  const paid = await prisma.order.create({
    data: {
      userId: user.id,
      status: "PAYMENT_PENDING",
      totalAmount: 1000,
      depositAmount: 50,
      grandTotal: 1050,
      contactName: "x",
      contactPhone: "9999999999",
      addressLine1: "a street 1",
      city: "B",
      state: "K",
      pincode: "560001",
      createdAt: new Date(Date.now() - 30 * 3600_000),
      events: { create: { status: "PAYMENT_PENDING", note: "seed" } },
    },
  });
  await prisma.payment.create({
    data: { orderId: paid.id, razorpayOrderId: `order_SWEEPCAP${Date.now()}`, status: "CAPTURED", amount: 1050 },
  });
  const sweepRes2 = await fetch(`${BASE}/api/admin/sweep-orders`, {
    method: "POST",
    headers: { Authorization: "Bearer dev-local-sweep-secret" },
  });
  const paidAfter = await prisma.order.findUnique({ where: { id: paid.id } });
  const paidExpiredEvent = await prisma.orderEvent.findFirst({ where: { orderId: paid.id, status: "PAYMENT_EXPIRED" } });
  step(
    "sweep skips a stale order whose payment is CAPTURED",
    sweepRes2.status === 200 && paidAfter.status === "PAYMENT_PENDING" && !paidExpiredEvent,
  );
  await prisma.orderEvent.deleteMany({ where: { orderId: paid.id } });
  await prisma.payment.deleteMany({ where: { orderId: paid.id } });
  await prisma.order.delete({ where: { id: paid.id } });

  // late capture on the expired order → auto-refund intent (asserts the
  // late-capture guard never resurrects the order, regardless of whether
  // the gateway refund call itself succeeds against a fake payment id)
  await postWebhook({
    event: "payment.captured",
    payload: { payment: { entity: { id: `pay_LATE${Date.now()}`, order_id: oldGw } } },
  });
  const alert = await prisma.orderEvent.findFirst({ where: { orderId: old.id, note: { contains: "after order expiry" } } });
  const stillDead = await prisma.order.findUnique({ where: { id: old.id } });
  step("late capture never resurrects the order", !!alert && stillDead.status === "PAYMENT_EXPIRED");

  // cleanup
  await prisma.orderEvent.deleteMany({ where: { orderId: old.id } });
  await prisma.orderRefund.deleteMany({ where: { orderId: old.id } });
  await prisma.payment.deleteMany({ where: { orderId: old.id } });
  await prisma.order.delete({ where: { id: old.id } });
}

// ── 10. customer surfaces ──
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

// ── 11. auto-split: manual multi-item order ──
{
  const variants = await prisma.productVariant.findMany({
    take: 3,
    where: { product: { isActive: true } },
    include: { product: true },
  });

  // Odd, non-round prices — chosen to prove the proration math has no
  // rounding drift (manually traced: goods 10001/20003/30007 → parent
  // totalAmount 60011, depositAmount 3001, grandTotal 63012; per-child
  // deposit 500/1000/1501, grand 10501/21003/31508 — sums exact).
  const res = await api("/api/admin/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: user.id,
      contactName: "Split Buyer",
      contactPhone: "9876543210",
      addressLine1: "9 Residency Road",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      applyDeposit: true,
      initialStatus: "PAYMENT_CONFIRMED",
      paymentNote: "UPI ref SPLIT1",
      items: [10001, 20003, 30007].map((unitPrice, i) => ({
        variantId: variants[i].id,
        quantity: 1,
        unitPrice,
      })),
    }),
  });
  step(
    "manual multi-item order creates 3 children",
    res.status === 201 && res.body?.childOrderIds?.length === 3,
    JSON.stringify(res.body),
  );

  const parentA = await prisma.order.findUnique({
    where: { id: res.body.orderId },
    include: { children: { orderBy: { createdAt: "asc" } }, items: true },
  });
  const sum = (f) => parentA.children.reduce((s, c) => s + Number(c[f]), 0);
  step(
    "parent → SPLIT_INTO_DELIVERIES, items moved off parent",
    parentA.status === "SPLIT_INTO_DELIVERIES" && parentA.items.length === 0,
  );
  step(
    "proration sums exact (no rounding drift)",
    sum("totalAmount") === Number(parentA.totalAmount) &&
      sum("depositAmount") === Number(parentA.depositAmount) &&
      sum("grandTotal") === Number(parentA.grandTotal),
    `totalAmount ${sum("totalAmount")}/${parentA.totalAmount} deposit ${sum("depositAmount")}/${parentA.depositAmount} grand ${sum("grandTotal")}/${parentA.grandTotal}`,
  );
  const [c0, c1, c2] = parentA.children;
  step(
    "per-child proration matches hand-traced values",
    Number(c0.totalAmount) === 10001 &&
      Number(c0.depositAmount) === 500 &&
      Number(c0.grandTotal) === 10501 &&
      Number(c1.totalAmount) === 20003 &&
      Number(c1.depositAmount) === 1000 &&
      Number(c1.grandTotal) === 21003 &&
      Number(c2.totalAmount) === 30007 &&
      Number(c2.depositAmount) === 1501 &&
      Number(c2.grandTotal) === 31508,
    parentA.children.map((c) => `${c.totalAmount}/${c.depositAmount}/${c.grandTotal}`).join(" | "),
  );
  step(
    "children all inherit PAYMENT_CONFIRMED (parent's status at split time)",
    parentA.children.every((c) => c.status === "PAYMENT_CONFIRMED" && c.parentOrderId === parentA.id),
  );

  // Admin child page: "Payment via parent" banner (offline order → no
  // gateway payment, banner still renders since it's keyed on parentOrderId).
  await page.goto(`${BASE}/admin/orders/${c0.id}`, { waitUntil: "networkidle" });
  let body = await page.textContent("body");
  step("admin child page shows Payment via parent banner", body.includes("Payment via parent") && body.includes(parentA.id));

  // Admin parent page: children table + money rollup.
  await page.goto(`${BASE}/admin/orders/${parentA.id}`, { waitUntil: "networkidle" });
  body = await page.textContent("body");
  step(
    "admin parent page lists children + rollup",
    body.includes("3 Deliveries") && body.includes(c0.id) && body.includes("captured") && body.includes("remaining"),
  );

  // Single-item manual order must NOT split.
  const singleRes = await api("/api/admin/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: user.id,
      contactName: "Single Buyer",
      contactPhone: "9876543210",
      addressLine1: "1 Single Street",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      applyDeposit: true,
      initialStatus: "PAYMENT_CONFIRMED",
      items: [{ variantId: variants[0].id, quantity: 1, unitPrice: 5000 }],
    }),
  });
  const singleOrder = await prisma.order.findUnique({ where: { id: singleRes.body.orderId } });
  step(
    "single-item manual order stays unsplit (no-op)",
    singleRes.status === 201 && !singleRes.body.childOrderIds && singleOrder.status === "PAYMENT_CONFIRMED" && !singleOrder.parentOrderId,
  );

  // cleanup
  const allIds = [...parentA.children.map((c) => c.id), parentA.id, singleOrder.id];
  for (const oid of allIds) {
    await prisma.orderEvent.deleteMany({ where: { orderId: oid } });
    await prisma.orderRefund.deleteMany({ where: { orderId: oid } });
    await prisma.shipment.deleteMany({ where: { orderId: oid } });
    await prisma.orderItem.deleteMany({ where: { orderId: oid } });
  }
  await prisma.order.deleteMany({ where: { parentOrderId: parentA.id } });
  await prisma.order.delete({ where: { id: parentA.id } });
  await prisma.order.delete({ where: { id: singleOrder.id } });
}

// ── 12. auto-split: online checkout multi-item order ──
{
  const variants = await prisma.productVariant.findMany({
    take: 2,
    where: { product: { isActive: true } },
    include: { product: true },
  });
  // goods 15000 + 9999 = 24999 → grandTotal 26249, deposit 1250; children:
  // 15000/750/15750 and 9999/500/10499 (hand-traced, sums exact).
  const lineItems = [
    { variantId: variants[0].id, price: 15000 },
    { variantId: variants[1].id, price: 9999 },
  ];
  const totalB = lineItems.reduce((s, i) => s + i.price, 0);
  const grandB = Math.round(totalB * 1.05);
  const gwOrderB = `order_SPLIT${Date.now()}`;
  const gwPaymentB = `pay_SPLIT${Date.now()}`;

  const parentSeed = await prisma.order.create({
    data: {
      userId: user.id,
      status: "PAYMENT_PENDING",
      totalAmount: totalB,
      depositAmount: grandB - totalB,
      grandTotal: grandB,
      contactName: "Split Online Buyer",
      contactPhone: "9876543210",
      addressLine1: "2 Brigade Road",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      items: {
        create: lineItems.map((i) => ({
          variantId: i.variantId,
          quantity: 1,
          price: i.price,
          productName: variants.find((v) => v.id === i.variantId).product.name,
        })),
      },
      events: { create: { status: "PAYMENT_PENDING", note: "Order created" } },
    },
  });
  await prisma.payment.create({
    data: { orderId: parentSeed.id, razorpayOrderId: gwOrderB, status: "CREATED", amount: grandB },
  });

  const capRes = await postWebhook({
    event: "payment.captured",
    payload: { payment: { entity: { id: gwPaymentB, order_id: gwOrderB } } },
  });
  const parentB = await prisma.order.findUnique({
    where: { id: parentSeed.id },
    include: { children: { orderBy: { createdAt: "asc" } }, payment: true, items: true },
  });
  step(
    "payment.captured on multi-item order splits atomically",
    capRes.status === 200 && parentB.status === "SPLIT_INTO_DELIVERIES" && parentB.children.length === 2,
  );
  const sumB = (f) => parentB.children.reduce((s, c) => s + Number(c[f]), 0);
  step(
    "online split proration sums exact",
    sumB("totalAmount") === Number(parentB.totalAmount) &&
      sumB("depositAmount") === Number(parentB.depositAmount) &&
      sumB("grandTotal") === Number(parentB.grandTotal),
  );
  step(
    "children of online split reuse the parent's Payment row (no own payment)",
    parentB.payment?.status === "CAPTURED" && parentB.payment.razorpayPaymentId === gwPaymentB,
  );

  const [b0, b1] = parentB.children;

  // Drive one child to DELIVERED, then attempt a deposit refund — proves
  // the child's refund resolves the PARENT's gateway payment (lib/refunds.ts
  // resolvePayment), not an (always-absent) payment of its own.
  await api(`/api/admin/orders/${b0.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "PREPARING" }),
  });
  await api(`/api/admin/orders/${b0.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "SHIPPED", courierName: "DTDC", awbCode: "SPLIT-AWB-1" }),
  });
  await api(`/api/admin/orders/${b0.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "DELIVERED" }),
  });
  const refundRes = await api(`/api/admin/orders/${b0.id}/refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "deposit", reason: "test child deposit refund" }),
  });
  step(
    GATEWAY_CONFIGURED
      ? "child deposit refund resolves parent payment → 502 (gateway refused simulated payment)"
      : "child deposit refund resolves parent payment → 503 (gateway not configured, not 'offline' path)",
    GATEWAY_CONFIGURED ? refundRes.status === 502 : refundRes.status === 503,
    `status ${refundRes.status}`,
  );

  // Review fix #3: refunding directly on the split PARENT is rejected —
  // money for a split order must move through an individual delivery.
  const parentRefundRes = await api(`/api/admin/orders/${parentB.id}/refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "full", reason: "should be rejected" }),
  });
  step(
    "refund directly on a split parent is rejected (409)",
    parentRefundRes.status === 409 && /split into deliveries/i.test(parentRefundRes.body?.error ?? ""),
    `status ${parentRefundRes.status} — ${parentRefundRes.body?.error}`,
  );

  // Review fix #2: a sibling's completed deposit refund must not block this
  // delivery's OWN deposit refund. Simulate b0's deposit as fully refunded
  // (ledger row + the same Payment.refundedAmount bump the webhook would
  // apply — that field is shared across all children of one parent), then
  // confirm b1 — delivered, its own deposit untouched — still offers its
  // own deposit-refund button on the admin page.
  await api(`/api/admin/orders/${b1.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "PREPARING" }),
  });
  await api(`/api/admin/orders/${b1.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "SHIPPED", courierName: "DTDC", awbCode: "SPLIT-AWB-2" }),
  });
  await api(`/api/admin/orders/${b1.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "DELIVERED" }),
  });
  await prisma.orderRefund.create({
    data: {
      orderId: b0.id,
      amount: Number(b0.depositAmount),
      kind: "DEPOSIT",
      method: "GATEWAY",
      gatewayRefundId: `rfnd_SIBLING${Date.now()}`,
      reason: "sibling deposit refund (simulated)",
      status: "COMPLETED",
    },
  });
  await prisma.payment.update({
    where: { id: parentB.payment.id },
    data: { refundedAmount: { increment: Number(b0.depositAmount) } },
  });
  await page.goto(`${BASE}/admin/orders/${b1.id}`, { waitUntil: "networkidle" });
  let adminBody = await page.textContent("body");
  step(
    "sibling's deposit refund doesn't block this delivery's own refund button",
    adminBody.includes("Refund…"),
  );

  // Customer surfaces.
  await page.goto(`${BASE}/account/orders`, { waitUntil: "networkidle" });
  let body = await page.textContent("body");
  step("customer orders list shows 'N deliveries' for split parent", body.includes("2 deliveries"));

  await page.goto(`${BASE}/account/orders/${parentB.id}`, { waitUntil: "networkidle" });
  body = await page.textContent("body");
  step(
    "customer parent page renders delivery cards",
    body.includes("2 Deliveries") && body.includes("Delivery 1 of 2") && body.includes("Delivery 2 of 2"),
  );

  // track-order on the parent id returns children summaries.
  const track = await api("/api/track-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: parentB.id, email: EMAIL }),
  });
  step(
    "track-order on parent id includes children summaries",
    track.status === 200 &&
      Array.isArray(track.body?.children) &&
      track.body.children.length === 2 &&
      track.body.children.some((c) => c.orderId === b0.id) &&
      track.body.children.some((c) => c.orderId === b1.id),
  );

  // cleanup
  const allIdsB = [...parentB.children.map((c) => c.id), parentB.id];
  for (const oid of allIdsB) {
    await prisma.orderEvent.deleteMany({ where: { orderId: oid } });
    await prisma.orderRefund.deleteMany({ where: { orderId: oid } });
    await prisma.shipment.deleteMany({ where: { orderId: oid } });
    await prisma.orderItem.deleteMany({ where: { orderId: oid } });
  }
  await prisma.payment.deleteMany({ where: { orderId: parentB.id } });
  await prisma.order.deleteMany({ where: { parentOrderId: parentB.id } });
  await prisma.order.delete({ where: { id: parentB.id } });
}

// ── cleanup ──
await prisma.orderEvent.deleteMany({ where: { orderId: order.id } });
await prisma.orderRefund.deleteMany({ where: { orderId: order.id } });
await prisma.shipment.deleteMany({ where: { orderId: order.id } });
await prisma.payment.deleteMany({ where: { orderId: order.id } });
await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
await prisma.order.delete({ where: { id: order.id } });
console.log("      cleaned up test order");

await browser.close();
await prisma.$disconnect();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
