/**
 * End-to-end order lifecycle test — pricing v2 (no deposit model) + the
 * active payment gateway (mock by default; also works against real Razorpay
 * keys with PAYMENT_GATEWAY=razorpay). Runs WITHOUT needing real gateway
 * keys when the mock gateway is active.
 *
 * Gateway-side calls (payment intent creation) are bypassed by seeding the
 * Order/Payment rows directly, exactly as /api/checkout would; everything
 * downstream — webhook capture, admin transitions, shipping entry, refund
 * webhook, customer pages — is exercised through the real HTTP surface, with
 * webhooks signed for whichever gateway is actually configured
 * (PAYMENT_GATEWAY env, mock by default).
 *
 *   1. checkout: 200 + intent (mock, or razorpay with real keys) OR 503 (razorpay, no keys)
 *   2. seed order + payment exactly as /api/checkout would (pricing v2: grandTotal = totalAmount, no deposit)
 *   3. payment.captured webhook (signed) → PAYMENT_CONFIRMED, cart cleared
 *   4. duplicate webhook delivery → idempotent no-op
 *   5. bad webhook signature → 400
 *   6. admin: PREPARING → SHIPPED (courier+AWB required) → DELIVERED (terminal, no deposit step)
 *   7. refund API without gateway configured → 503 (only reachable if PAYMENT_GATEWAY=razorpay + no keys)
 *   8. full refund on a DELIVERED order, ledger-matched refund.processed webhook → REFUNDED
 *   8b. LEGACY backward-compat: a pre-pricing-v2 order (depositAmount > 0) still
 *       supports kind:"deposit" refunds and reaches DEPOSIT_REFUNDED
 *   9. sweep expires a stale PAYMENT_PENDING order; late capture on it never resurrects;
 *      sweep skips CAPTURED payments and manual/offline orders with no Payment row;
 *      sweep releases a reserved promo redemption
 *   10. customer surfaces: /account/orders, order detail, /track-order API
 *   11. auto-split: manual multi-item order (POST /api/admin/orders) → children created atomically,
 *       proration exact (goods 10001/20003/30007, no deposit); single-item manual order stays unsplit
 *   12. auto-split: online checkout multi-item order → payment.captured splits atomically with
 *       confirmation; child refund resolves the parent's payment; customer/admin/track-order rendering
 *   13. delivery-fail → retry (OUT_FOR_DELIVERY) → deliver
 *   14. delivery-fail → RTO → RTO_RECEIVED → re-dispatch (new Shipment row) → deliver
 *   15. RTO_RECEIVED → CANCELLED → offline partial refund → REFUNDED with ledger row
 *   16. customer return: window enforcement (accept/reject), second request on an already-requested
 *       order rejected, request → approve → received → QC-pass offline refund → REFUNDED
 *   17. return reject: wrong revert target → 409; correct revert → exact prior status
 *   18. QC-fail: RETURN_RECEIVED → PREPARING requires a reason note → re-dispatch
 *   19. FAILED_OTHER requires a reason note → offline refund mark → REFUNDED with ledger row
 *   20. order notes: internal vs customer-visible on track-order; PATCH visibility toggle
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
const envVar = (name) => envFile.match(new RegExp(`^${name}=(.+)$`, "m"))?.[1]?.trim();

// Gateway-aware: whichever PAYMENT_GATEWAY is active is what /api/checkout
// and /api/webhooks/payment actually use — sign webhooks to match, and only
// take the "not configured" 503 branch when that specific gateway lacks keys.
const GATEWAY = envVar("PAYMENT_GATEWAY") || "razorpay";
const RAZORPAY_WEBHOOK_SECRET = envVar("RAZORPAY_WEBHOOK_SECRET");
const RAZORPAY_KEY_ID = envVar("RAZORPAY_KEY_ID");
const MOCK_PAYMENT_SECRET = envVar("MOCK_PAYMENT_SECRET") || "vairis-mock-secret";
const GATEWAY_CONFIGURED = GATEWAY === "mock" ? true : Boolean(RAZORPAY_KEY_ID);
if (GATEWAY === "razorpay" && !RAZORPAY_WEBHOOK_SECRET) {
  throw new Error("RAZORPAY_WEBHOOK_SECRET missing from .env.local");
}

let pass = 0;
let fail = 0;
let shippedAwb; // captured in section 6, reused by later sections' AWB assertions
const step = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

/**
 * Sign + POST a normalized payment event to /api/webhooks/payment for
 * whichever gateway is active. `kind` is the normalized vocabulary
 * (captured | failed | refunded); ids/amount are gateway-agnostic —
 * this builds the correct wire shape + header per gateway.
 */
async function postWebhook(kind, { gatewayOrderId, gatewayPaymentId, gatewayRefundId, amount } = {}, { badSignature = false } = {}) {
  let raw, header, signature;

  if (GATEWAY === "mock") {
    const eventMap = { captured: "payment.captured", failed: "payment.failed", refunded: "refund.processed" };
    const body = { event: eventMap[kind], gatewayOrderId, gatewayPaymentId, gatewayRefundId, amount };
    raw = JSON.stringify(body);
    header = "x-mock-signature";
    signature = crypto.createHmac("sha256", MOCK_PAYMENT_SECRET).update(raw).digest("hex");
  } else {
    const bodies = {
      captured: { event: "payment.captured", payload: { payment: { entity: { id: gatewayPaymentId, order_id: gatewayOrderId } } } },
      failed: { event: "payment.failed", payload: { payment: { entity: { id: gatewayPaymentId, order_id: gatewayOrderId } } } },
      refunded: { event: "refund.processed", payload: { refund: { entity: { id: gatewayRefundId, payment_id: gatewayPaymentId, amount: Math.round(amount * 100) } } } },
    };
    raw = JSON.stringify(bodies[kind]);
    header = "x-razorpay-signature";
    signature = crypto.createHmac("sha256", RAZORPAY_WEBHOOK_SECRET).update(raw).digest("hex");
  }

  return fetch(`${BASE}/api/webhooks/payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", [header]: badSignature ? "deadbeef".repeat(8) : signature },
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

async function cleanupOrder(id) {
  await prisma.promoRedemption.deleteMany({ where: { orderId: id } });
  await prisma.orderNote.deleteMany({ where: { orderId: id } });
  await prisma.orderRefund.deleteMany({ where: { orderId: id } });
  await prisma.orderEvent.deleteMany({ where: { orderId: id } });
  await prisma.shipment.deleteMany({ where: { orderId: id } });
  await prisma.orderItem.deleteMany({ where: { orderId: id } });
  await prisma.payment.deleteMany({ where: { orderId: id } });
  await prisma.order.delete({ where: { id } }).catch((err) => {
    if (err?.code !== "P2025") throw err;
  });
}

// ── 1. checkout ──
{
  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  const variant = await prisma.productVariant.findFirst({ where: { product: { isActive: true, status: "LIVE" } } });
  await prisma.cartItem.upsert({
    where: { userId_variantId_withExchange: { userId: user.id, variantId: variant.id, withExchange: false } },
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
      `checkout with ${GATEWAY} configured → 200 + gateway intent`,
      res.status === 200 && !!res.body?.clientParams && !!res.body?.orderId && res.body?.gateway === GATEWAY,
      `status ${res.status}`,
    );
    if (res.body?.orderId) await cleanupOrder(res.body.orderId);
  } else {
    step(
      "checkout without keys → 503 PAYMENTS_NOT_CONFIGURED",
      res.status === 503 && res.body?.error === "PAYMENTS_NOT_CONFIGURED",
      `status ${res.status}`,
    );
  }
}

// ── 2. seed order + payment exactly as /api/checkout would (pricing v2:
//      grandTotal === totalAmount, depositAmount always 0 on new orders) ──
const user = await prisma.user.findUnique({ where: { email: EMAIL } });
const variant = await prisma.productVariant.findFirst({ where: { product: { isActive: true, status: "LIVE" } }, include: { product: true } });
const total = 20000;
const grandTotal = total;
const gwOrderId = `order_SIM${Date.now()}`;
const gwPaymentId = `pay_SIM${Date.now()}`;

const order = await prisma.order.create({
  data: {
    userId: user.id,
    status: "PAYMENT_PENDING",
    totalAmount: total,
    depositAmount: 0,
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
  const res = await postWebhook("captured", { gatewayOrderId: gwOrderId, gatewayPaymentId: gwPaymentId });
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
  await postWebhook("captured", { gatewayOrderId: gwOrderId, gatewayPaymentId: gwPaymentId });
  const events = await prisma.orderEvent.count({ where: { orderId: order.id, status: "PAYMENT_CONFIRMED" } });
  step("duplicate payment.captured is idempotent", events === 1, `${events} confirmation event(s)`);
}

// ── 5. bad signature → 400 ──
{
  const res = await postWebhook("captured", { gatewayOrderId: "y", gatewayPaymentId: "x" }, { badSignature: true });
  step("tampered webhook signature rejected", res.status === 400, `status ${res.status}`);
}

// ── 6. admin transitions — DELIVERED is now the terminal happy state (no deposit step) ──
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

  // Shipping-provider-aware: the manual provider requires courier/AWB and
  // 400s without them; a booking-capable provider (Shiprocket/DTDC, live or
  // SHIPPING_MOCK) auto-books instead — both are correct, just different
  // active configs (see .env.local SHIPPING_PROVIDER / SHIPPING_MOCK).
  const shippingProvider = envVar("SHIPPING_PROVIDER") || "manual";
  const shippingAutoBooks = shippingProvider !== "manual";

  if (shippingAutoBooks) {
    res = await api(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "SHIPPED" }),
    });
    const autoShipment = await prisma.shipment.findFirst({ where: { orderId: order.id } });
    shippedAwb = autoShipment?.awbCode;
    step(
      `SHIPPED without courier/AWB auto-books via ${shippingProvider}`,
      res.status === 200 && !!shippedAwb,
      `status ${res.status}, awb ${shippedAwb}`,
    );
  } else {
    res = await api(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "SHIPPED" }),
    });
    step("SHIPPED without courier/AWB rejected (manual provider)", res.status === 400, `status ${res.status}`);

    // Manually-typed courier/AWB always win as an override, regardless of
    // provider (see app/api/admin/orders/[id]/route.ts).
    shippedAwb = "BD123456789";
    res = await api(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "SHIPPED",
        courierName: "BlueDart",
        awbCode: shippedAwb,
        trackingUrl: `https://bluedart.com/track/${shippedAwb}`,
      }),
    });
    const shipment = await prisma.shipment.findFirst({
      where: { orderId: order.id },
      orderBy: { dispatchedAt: "desc" },
    });
    step("→ SHIPPED with manual courier details", res.status === 200 && shipment?.awbCode === shippedAwb);
  }

  res = await api(`/api/admin/orders/${order.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "DELIVERED" }),
  });
  const afterDelivered = await prisma.order.findUnique({ where: { id: order.id } });
  step(
    "→ DELIVERED (terminal — pricing v2 has no deposit step)",
    res.status === 200 && afterDelivered.status === "DELIVERED",
    `status ${res.status}`,
  );
}

// ── 7. refund API without gateway configured → 503 (only when the active
//      gateway genuinely lacks keys; skipped for mock, which is always "on") ──
{
  if (!GATEWAY_CONFIGURED) {
    const res = await api(`/api/admin/orders/${order.id}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "full", reason: "test refund, gateway not configured" }),
    });
    step("refund initiation without keys → 503 (not-configured path)", res.status === 503, `status ${res.status}`);
  } else {
    step("refund-not-configured path — skipped (active gateway is configured)", true);
  }
}

// ── 8. full refund on a DELIVERED order, ledger-matched refund.processed webhook ──
{
  let refundId;
  let initiateStatus;
  if (GATEWAY === "mock") {
    // Mock gateway self-posts the refund.processed webhook ~800ms after
    // createRefund resolves — call the real refund endpoint and wait for it.
    const res = await api(`/api/admin/orders/${order.id}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "full", reason: "test full refund via mock gateway" }),
    });
    initiateStatus = res.status;
    step("mock gateway refund initiation → 200", res.status === 200, `status ${res.status}`);
    await new Promise((r) => setTimeout(r, 1500)); // let the mock's async webhook land
  } else {
    // Real gateways: no live payment exists for a simulated payment id, so
    // ledger-match the intent directly and post the webhook ourselves —
    // exactly mirrors what a real refund.processed delivery would do.
    refundId = `rfnd_LEDGER${Date.now()}`;
    await prisma.orderRefund.create({
      data: { orderId: order.id, amount: grandTotal, kind: "FULL", method: "GATEWAY", gatewayRefundId: refundId, reason: "test full refund", status: "INITIATED" },
    });
    await postWebhook("refunded", { gatewayPaymentId: gwPaymentId, gatewayRefundId: refundId, amount: grandTotal });
    initiateStatus = 200;
  }
  const after = await prisma.order.findUnique({ where: { id: order.id }, include: { refunds: true } });
  step(
    "full refund → REFUNDED with a COMPLETED ledger row",
    initiateStatus === 200 && after.status === "REFUNDED" && after.refunds.some((r) => r.status === "COMPLETED"),
    `order=${after.status} refunds=${JSON.stringify(after.refunds.map((r) => r.status))}`,
  );

  // duplicate delivery is a no-op (only meaningful for the manually-posted path)
  if (refundId) {
    await postWebhook("refunded", { gatewayPaymentId: gwPaymentId, gatewayRefundId: refundId, amount: grandTotal });
    const events = await prisma.orderEvent.count({ where: { orderId: order.id, note: { contains: "Refund" } } });
    step("duplicate refund webhook idempotent", events <= 2, `${events} refund event(s)`); // initiated + completed, no 3rd
  }
}

// ── 8b. LEGACY backward-compat: a pre-pricing-v2 order (depositAmount > 0)
//        still supports kind:"deposit" refunds through to DEPOSIT_REFUNDED ──
{
  const legacyGwOrderId = `order_LEGACY${Date.now()}`;
  const legacyGwPaymentId = `pay_LEGACY${Date.now()}`;
  const legacyTotal = 10000;
  const legacyDeposit = 500;
  const legacyGrand = legacyTotal + legacyDeposit;

  const legacy = await prisma.order.create({
    data: {
      userId: user.id,
      status: "DELIVERED",
      totalAmount: legacyTotal,
      depositAmount: legacyDeposit,
      grandTotal: legacyGrand,
      contactName: "Legacy Deposit Buyer",
      contactPhone: "9876543210",
      addressLine1: "3 Old Model Lane",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      events: { create: { status: "DELIVERED", note: "seed — legacy deposit-model order" } },
    },
  });
  await prisma.payment.create({
    data: { orderId: legacy.id, razorpayOrderId: legacyGwOrderId, razorpayPaymentId: legacyGwPaymentId, status: "CAPTURED", amount: legacyGrand },
  });

  let refundedOk;
  if (GATEWAY === "mock") {
    const res = await api(`/api/admin/orders/${legacy.id}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "deposit", reason: "legacy deposit refund test" }),
    });
    await new Promise((r) => setTimeout(r, 1500));
    refundedOk = res.status === 200;
  } else {
    const legacyRefundId = `rfnd_LEGACY${Date.now()}`;
    await prisma.orderRefund.create({
      data: { orderId: legacy.id, amount: legacyDeposit, kind: "DEPOSIT", method: "GATEWAY", gatewayRefundId: legacyRefundId, reason: "legacy deposit refund test", status: "INITIATED" },
    });
    await postWebhook("refunded", { gatewayPaymentId: legacyGwPaymentId, gatewayRefundId: legacyRefundId, amount: legacyDeposit });
    refundedOk = true;
  }
  const legacyAfter = await prisma.order.findUnique({ where: { id: legacy.id } });
  step(
    "legacy deposit-model order: kind:'deposit' refund still reaches DEPOSIT_REFUNDED",
    refundedOk && legacyAfter.status === "DEPOSIT_REFUNDED",
    `status ${legacyAfter.status}`,
  );
  await cleanupOrder(legacy.id);
}

// ── 9. sweep + late capture + promo release ──
{
  const old = await prisma.order.create({
    data: {
      userId: user.id,
      status: "PAYMENT_PENDING",
      totalAmount: 1000,
      depositAmount: 0,
      grandTotal: 1000,
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
  await prisma.payment.create({ data: { orderId: old.id, razorpayOrderId: oldGw, status: "CREATED", amount: 1000 } });

  // A reserved promo redemption on this stale order must be released by the sweep.
  const sweepPromo = await prisma.promoCode.create({
    data: { code: `SWEEPTEST${Date.now()}`, kind: "FLAT", value: 100, maxPerUser: 1 },
  });
  await prisma.promoRedemption.create({
    data: { promoCodeId: sweepPromo.id, userId: user.id, orderId: old.id, amount: 100 },
  });

  const res = await fetch(`${BASE}/api/admin/sweep-orders`, {
    method: "POST",
    headers: { Authorization: "Bearer dev-local-sweep-secret" },
  });
  const after = await prisma.order.findUnique({ where: { id: old.id } });
  step("sweep expires stale unpaid order", res.status === 200 && after.status === "PAYMENT_EXPIRED");

  const redemptionGone = await prisma.promoRedemption.count({ where: { orderId: old.id } });
  step("sweep releases the reserved promo redemption", redemptionGone === 0, `${redemptionGone} redemption row(s) remain`);
  await prisma.promoCode.delete({ where: { id: sweepPromo.id } });

  // a stale order whose payment already CAPTURED must survive the sweep —
  // this is what the race fix in sweep-orders/route.ts protects
  const paid = await prisma.order.create({
    data: {
      userId: user.id,
      status: "PAYMENT_PENDING",
      totalAmount: 1000,
      depositAmount: 0,
      grandTotal: 1000,
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
    data: { orderId: paid.id, razorpayOrderId: `order_SWEEPCAP${Date.now()}`, status: "CAPTURED", amount: 1000 },
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
  await cleanupOrder(paid.id);

  // Bug 2 regression: a manual/WhatsApp admin-order-entry order has NO
  // Payment row at all (offline order awaiting bank transfer/WhatsApp
  // confirmation, not an abandoned online checkout). Stale though it looks
  // by createdAt, the sweep must never touch it — only orders that came
  // through the online gateway checkout path (i.e. have a Payment row) are
  // sweep candidates.
  const manualStale = await prisma.order.create({
    data: {
      userId: user.id,
      status: "PAYMENT_PENDING",
      totalAmount: 1000,
      depositAmount: 0,
      grandTotal: 1000,
      contactName: "Manual Offline Buyer",
      contactPhone: "9999999999",
      addressLine1: "a street 1",
      city: "B",
      state: "K",
      pincode: "560001",
      createdAt: new Date(Date.now() - 30 * 3600_000),
      events: { create: { status: "PAYMENT_PENDING", note: "manual order — awaiting bank transfer" } },
    },
  });
  const sweepRes3 = await fetch(`${BASE}/api/admin/sweep-orders`, {
    method: "POST",
    headers: { Authorization: "Bearer dev-local-sweep-secret" },
  });
  const manualAfter = await prisma.order.findUnique({ where: { id: manualStale.id } });
  const manualExpiredEvent = await prisma.orderEvent.findFirst({
    where: { orderId: manualStale.id, status: "PAYMENT_EXPIRED" },
  });
  step(
    "sweep never expires a manual/offline order with no Payment row",
    sweepRes3.status === 200 && manualAfter.status === "PAYMENT_PENDING" && !manualExpiredEvent,
  );
  await cleanupOrder(manualStale.id);

  // late capture on the expired order → auto-refund intent (asserts the
  // late-capture guard never resurrects the order, regardless of whether
  // the gateway refund call itself succeeds against a fake payment id)
  await postWebhook("captured", { gatewayOrderId: oldGw, gatewayPaymentId: `pay_LATE${Date.now()}` });
  const alert = await prisma.orderEvent.findFirst({ where: { orderId: old.id, note: { contains: "after order expiry" } } });
  const stillDead = await prisma.order.findUnique({ where: { id: old.id } });
  step("late capture never resurrects the order", !!alert && stillDead.status === "PAYMENT_EXPIRED");

  await cleanupOrder(old.id);
}

// ── 10. customer surfaces ──
{
  await page.goto(`${BASE}/account/orders`, { waitUntil: "networkidle" });
  const listed = await page.locator(`a[href="/account/orders/${order.id}"]`).count();
  step("order listed on /account/orders", listed === 1);

  await page.goto(`${BASE}/account/orders/${order.id}`, { waitUntil: "networkidle" });
  const body = await page.textContent("body");
  // Pricing v2: no deposit on this order, so the "Security Deposit" card is
  // hidden (it only renders when deposit > 0 or refunded > 0) — assert the
  // timeline + AWB instead, which always render.
  step(
    "order detail shows timeline + AWB, refund shown as 'Refunds'",
    body.includes(shippedAwb) && (body.includes("Refunds") || body.includes("REFUNDED") || body.includes("Refunded")),
  );
  await page.screenshot({ path: `${process.env.SHOTS_DIR ?? "/tmp"}/order-detail.png`, fullPage: true });

  const track = await api("/api/track-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: order.id, email: EMAIL }),
  });
  step(
    "public track-order lookup",
    track.status === 200 && track.body?.status === "REFUNDED" && track.body?.shipment?.awbCode === shippedAwb,
    JSON.stringify(track.body?.status),
  );

  const trackBad = await api("/api/track-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: order.id, email: "wrong@example.com" }),
  });
  step("track-order with wrong email → 404", trackBad.status === 404, `status ${trackBad.status}`);
}

// ── 11. auto-split: manual multi-item order (pricing v2: no deposit, grandTotal === totalAmount) ──
{
  const variants = await prisma.productVariant.findMany({
    take: 3,
    where: { product: { isActive: true, status: "LIVE" } },
    include: { product: true },
  });

  // Odd, non-round prices — chosen to prove the proration math has no
  // rounding drift even with 3-way splits (sums must match exactly).
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
    "proration sums exact (no rounding drift, no deposit)",
    sum("totalAmount") === Number(parentA.totalAmount) &&
      sum("depositAmount") === 0 &&
      sum("grandTotal") === Number(parentA.grandTotal) &&
      Number(parentA.grandTotal) === Number(parentA.totalAmount),
    `totalAmount ${sum("totalAmount")}/${parentA.totalAmount} grand ${sum("grandTotal")}/${parentA.grandTotal}`,
  );
  const [c0, c1, c2] = parentA.children;
  step(
    "per-child proration matches hand-traced values (grandTotal === totalAmount, deposit 0)",
    Number(c0.totalAmount) === 10001 && Number(c0.depositAmount) === 0 && Number(c0.grandTotal) === 10001 &&
      Number(c1.totalAmount) === 20003 && Number(c1.depositAmount) === 0 && Number(c1.grandTotal) === 20003 &&
      Number(c2.totalAmount) === 30007 && Number(c2.depositAmount) === 0 && Number(c2.grandTotal) === 30007,
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
  for (const c of parentA.children) await cleanupOrder(c.id);
  await cleanupOrder(parentA.id);
  await cleanupOrder(singleOrder.id);
}

// ── 12. auto-split: online checkout multi-item order (pricing v2 money model) ──
{
  const variants = await prisma.productVariant.findMany({
    take: 2,
    where: { product: { isActive: true, status: "LIVE" } },
    include: { product: true },
  });
  // goods 15000 + 9999 = 24999, no deposit, grandTotal === totalAmount;
  // children: 15000/0/15000 and 9999/0/9999 (hand-traced, sums exact).
  const lineItems = [
    { variantId: variants[0].id, price: 15000 },
    { variantId: variants[1].id, price: 9999 },
  ];
  const totalB = lineItems.reduce((s, i) => s + i.price, 0);
  const grandB = totalB;
  const gwOrderB = `order_SPLIT${Date.now()}`;
  const gwPaymentB = `pay_SPLIT${Date.now()}`;

  const parentSeed = await prisma.order.create({
    data: {
      userId: user.id,
      status: "PAYMENT_PENDING",
      totalAmount: totalB,
      depositAmount: 0,
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

  const capRes = await postWebhook("captured", { gatewayOrderId: gwOrderB, gatewayPaymentId: gwPaymentB });
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
    "online split proration sums exact (no deposit)",
    sumB("totalAmount") === Number(parentB.totalAmount) &&
      sumB("depositAmount") === 0 &&
      sumB("grandTotal") === Number(parentB.grandTotal),
  );
  step(
    "children of online split reuse the parent's Payment row (no own payment)",
    parentB.payment?.status === "CAPTURED" && parentB.payment.razorpayPaymentId === gwPaymentB,
  );

  const [b0, b1] = parentB.children;

  // Drive one child to DELIVERED, then attempt a full refund — proves the
  // child's refund resolves the PARENT's gateway payment (lib/refunds.ts
  // resolvePayment), not an (always-absent) payment of its own.
  await api(`/api/admin/orders/${b0.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "PREPARING" }),
  });
  await api(`/api/admin/orders/${b0.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "SHIPPED", courierName: "DTDC", awbCode: "SPLIT-AWB-1" }),
  });
  await api(`/api/admin/orders/${b0.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "DELIVERED" }),
  });
  const refundRes = await api(`/api/admin/orders/${b0.id}/refund`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "full", reason: "test child full refund" }),
  });
  step(
    "child full refund resolves parent payment → 200 (mock) / 502 (razorpay, simulated payment id)",
    GATEWAY === "mock" ? refundRes.status === 200 : refundRes.status === 502,
    `status ${refundRes.status}`,
  );
  if (GATEWAY === "mock") await new Promise((r) => setTimeout(r, 1500));

  // Review fix #3: refunding directly on the split PARENT is rejected —
  // money for a split order must move through an individual delivery.
  const parentRefundRes = await api(`/api/admin/orders/${parentB.id}/refund`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "full", reason: "should be rejected" }),
  });
  step(
    "refund directly on a split parent is rejected (409)",
    parentRefundRes.status === 409 && /split into deliveries/i.test(parentRefundRes.body?.error ?? ""),
    `status ${parentRefundRes.status} — ${parentRefundRes.body?.error}`,
  );

  // Bring b1 to DELIVERED too and confirm its refund path is independent of b0's.
  await api(`/api/admin/orders/${b1.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "PREPARING" }),
  });
  await api(`/api/admin/orders/${b1.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "SHIPPED", courierName: "DTDC", awbCode: "SPLIT-AWB-2" }),
  });
  await api(`/api/admin/orders/${b1.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "DELIVERED" }),
  });

  // Bug 1 regression: a SPLIT child's own order.payment is always null (the
  // Payment row lives on the parent — payment anchoring, lib/refunds.ts
  // resolvePayment). The admin route classifies "offline" (no gateway
  // payment → OFFLINE_SETTLEMENT_TRANSITIONS shortcuts become available) by
  // walking to the parent's payment, not just the child's own — if that walk
  // were missing, a split child would incorrectly qualify as offline and
  // allow a direct status PATCH to bypass /refund entirely (no ledger row,
  // no real refund). Pricing v2 retired the DELIVERED→DEPOSIT_REFUNDED
  // offline shortcut this originally targeted, so exercise the same guard
  // via the shortcut that still exists: DELIVERED → FAILED_OTHER (a normal,
  // listed transition) → then the FAILED_OTHER → REFUNDED offline shortcut.
  await api(`/api/admin/orders/${b1.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "FAILED_OTHER", note: "regression test — routing to offline-shortcut check" }),
  });
  const offlineBypassRes = await api(`/api/admin/orders/${b1.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "REFUNDED" }),
  });
  const b1AfterBypass = await prisma.order.findUnique({ where: { id: b1.id } });
  step(
    "split child with a real gateway payment (on the parent) rejects the offline REFUNDED shortcut — must use /refund",
    (offlineBypassRes.status === 400 || offlineBypassRes.status === 409) && b1AfterBypass.status === "FAILED_OTHER",
    `status ${offlineBypassRes.status}, order now ${b1AfterBypass.status}`,
  );
  // FAILED_OTHER has no further admin transition (terminal short of /refund)
  // — the refund-independence check below runs against this FAILED_OTHER
  // child directly; kind:"full" refunds aren't status-gated.

  const b1RefundRes = await api(`/api/admin/orders/${b1.id}/refund`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "full", reason: "sibling refund independence check" }),
  });
  step(
    "sibling's refund doesn't block this delivery's own refund",
    GATEWAY === "mock" ? b1RefundRes.status === 200 : b1RefundRes.status === 502,
    `status ${b1RefundRes.status}`,
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
    method: "POST", headers: { "Content-Type": "application/json" },
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
  for (const c of parentB.children) await cleanupOrder(c.id);
  await cleanupOrder(parentB.id);
}

// ── shared seed for the delivery/return scenarios below: an offline
// (no gateway Payment) order in an arbitrary starting status, optionally
// with a Shipment row already attached (as PATCH SHIPPED would create).
// Pricing v2: no deposit on freshly-seeded orders (grandTotal === totalAmount). ──
async function seedOrder(status, { shipment = false, events = undefined, label = "Lifecycle Buyer" } = {}) {
  const o = await prisma.order.create({
    data: {
      userId: user.id,
      status,
      totalAmount: 10000,
      depositAmount: 0,
      grandTotal: 10000,
      contactName: label,
      contactPhone: "9876543210",
      addressLine1: "5 Test Colony",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      events: { create: events ?? [{ status, note: "seed" }] },
    },
  });
  if (shipment) {
    await prisma.shipment.create({
      data: { orderId: o.id, courierName: "DTDC", awbCode: "SEED-AWB-1", status: "IN_TRANSIT" },
    });
  }
  return o;
}

// ── 13. delivery-fail → retry (OUT_FOR_DELIVERY) → deliver ──
{
  const o = await seedOrder("SHIPPED", { shipment: true });
  const patch = (status, extra = {}) => api(`/api/admin/orders/${o.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, ...extra }),
  });

  let res = await patch("DELIVERY_FAILED");
  step("delivery-fail without reason rejected", res.status === 400, `status ${res.status}`);

  res = await patch("DELIVERY_FAILED", { note: "Customer not home" });
  step("delivery-fail with reason ok", res.status === 200, `status ${res.status}`);
  let ship = await prisma.shipment.findFirst({ where: { orderId: o.id } });
  step("shipment attempt recorded, still one shipment row", ship.attempts === 1 && ship.status === "ATTEMPT_FAILED");

  res = await patch("OUT_FOR_DELIVERY");
  step("delivery-fail → retry OUT_FOR_DELIVERY", res.status === 200, `status ${res.status}`);

  res = await patch("DELIVERED");
  const after = await prisma.order.findUnique({ where: { id: o.id } });
  ship = await prisma.shipment.findFirst({ where: { orderId: o.id } });
  const count = await prisma.shipment.count({ where: { orderId: o.id } });
  step(
    "retry succeeds → DELIVERED, shipment count unchanged",
    res.status === 200 && after.status === "DELIVERED" && ship.outcome === "DELIVERED" && count === 1,
  );

  await cleanupOrder(o.id);
}

// ── 14. delivery-fail → RTO → RTO_RECEIVED → re-dispatch (new Shipment row) → deliver ──
{
  const o = await seedOrder("SHIPPED", { shipment: true });
  const patch = (status, extra = {}) => api(`/api/admin/orders/${o.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, ...extra }),
  });

  await patch("DELIVERY_FAILED", { note: "Wrong address" });
  let res = await patch("RETURNING_TO_ORIGIN");
  step("→ RETURNING_TO_ORIGIN", res.status === 200, `status ${res.status}`);
  let ship = await prisma.shipment.findFirst({ where: { orderId: o.id } });
  step("shipment marked RTO outcome", ship.outcome === "RTO" && ship.status === "RETURNING_TO_ORIGIN");

  res = await patch("RTO_RECEIVED");
  step("→ RTO_RECEIVED", res.status === 200, `status ${res.status}`);

  res = await patch("PREPARING", { note: "Address corrected on WhatsApp" });
  step("RTO re-dispatch → PREPARING", res.status === 200, `status ${res.status}`);

  res = await patch("SHIPPED", { courierName: "BlueDart", awbCode: "SEED-AWB-2" });
  const shipCount = await prisma.shipment.count({ where: { orderId: o.id } });
  step("re-dispatch creates a SECOND shipment row (count=2)", res.status === 200 && shipCount === 2, `count ${shipCount}`);

  res = await patch("DELIVERED");
  const after = await prisma.order.findUnique({ where: { id: o.id } });
  step("re-dispatched delivery → DELIVERED", res.status === 200 && after.status === "DELIVERED");

  await cleanupOrder(o.id);
}

// ── 15. RTO_RECEIVED → CANCELLED → offline partial refund → REFUNDED with ledger row ──
{
  const o = await seedOrder("RTO_RECEIVED");
  let res = await api(`/api/admin/orders/${o.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "CANCELLED" }),
  });
  step("RTO_RECEIVED → CANCELLED", res.status === 200, `status ${res.status}`);

  res = await api(`/api/admin/orders/${o.id}/refund`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "partial", amount: 5000, reason: "RTO cancellation — partial refund" }),
  });
  const after = await prisma.order.findUnique({ where: { id: o.id }, include: { refunds: true } });
  step(
    "offline partial refund on cancelled RTO → REFUNDED with ledger row",
    res.status === 200 && after.status === "REFUNDED" && after.refunds.length === 1 &&
      after.refunds[0].method === "OFFLINE" && Number(after.refunds[0].amount) === 5000,
    JSON.stringify({ status: after.status, refunds: after.refunds.length }),
  );

  await cleanupOrder(o.id);
}

// ── 16. customer return: window enforcement + second-request rejection +
//         full request → approve → received → QC-pass refund → REFUNDED ──
{
  // within window: DELIVERED event is "now"
  const r1 = await seedOrder("DELIVERED", { events: [{ status: "DELIVERED", note: "seed" }] });
  let res = await api(`/api/orders/${r1.id}/return-request`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: "Item does not match description" }),
  });
  step("return request within window accepted", res.status === 200, `status ${res.status}`);

  // second attempt on an already-RETURN_REQUESTED order is rejected by the
  // return-request route's own status check (only DELIVERED/DEPOSIT_REFUNDED
  // are eligible starting states) — NOT by ADMIN_TRANSITIONS.
  res = await api(`/api/orders/${r1.id}/return-request`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: "Trying again, second time" }),
  });
  step("second return-request on already-requested order rejected", res.status === 409, `status ${res.status}`);

  const patch1 = (status, extra = {}) => api(`/api/admin/orders/${r1.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, ...extra }),
  });
  res = await patch1("RETURN_IN_TRANSIT");
  step("admin approves → RETURN_IN_TRANSIT", res.status === 200, `status ${res.status}`);
  res = await patch1("RETURN_RECEIVED");
  step("→ RETURN_RECEIVED", res.status === 200, `status ${res.status}`);

  res = await api(`/api/admin/orders/${r1.id}/refund`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "partial", amount: 4000, reason: "QC passed — refund minus handling" }),
  });
  const r1After = await prisma.order.findUnique({ where: { id: r1.id }, include: { refunds: true } });
  step(
    "QC-pass offline refund → REFUNDED with ledger row",
    res.status === 200 && r1After.status === "REFUNDED" && r1After.refunds.length === 1,
    JSON.stringify({ status: r1After.status, refunds: r1After.refunds.length }),
  );
  await cleanupOrder(r1.id);

  // outside window: DELIVERED event backdated 10 days (default RETURN_WINDOW_DAYS=7)
  const deliveredOld = new Date(Date.now() - 10 * 86400_000);
  const r2 = await seedOrder("DELIVERED", { events: [{ status: "DELIVERED", note: "seed", createdAt: deliveredOld }] });
  res = await api(`/api/orders/${r2.id}/return-request`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: "Too late, testing window enforcement" }),
  });
  step("return request outside window rejected", res.status === 409, `status ${res.status}`);
  await cleanupOrder(r2.id);
}

// ── 17. return reject: wrong revert target → 409; correct revert → 200 ──
{
  const r3 = await seedOrder("DELIVERED", { events: [{ status: "DELIVERED", note: "seed" }] });
  await api(`/api/orders/${r3.id}/return-request`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: "Changed my mind, testing reject flow" }),
  });
  const patch3 = (status) => api(`/api/admin/orders/${r3.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
  });

  let res = await patch3("REFUNDED");
  step("reject with wrong revert target → 409", res.status === 409, `status ${res.status} — ${res.body?.error}`);

  res = await patch3("DELIVERED");
  const r3After = await prisma.order.findUnique({ where: { id: r3.id } });
  step(
    "reject reverts to exact prior status → 200",
    res.status === 200 && r3After.status === "DELIVERED",
    `status ${res.status}, order now ${r3After.status}`,
  );

  await cleanupOrder(r3.id);
}

// ── 18. QC-fail: RETURN_RECEIVED → PREPARING requires a reason note → re-dispatch ──
{
  const o = await seedOrder("RETURN_RECEIVED");
  const patch = (status, extra = {}) => api(`/api/admin/orders/${o.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, ...extra }),
  });

  let res = await patch("PREPARING");
  step("QC-fail → PREPARING without reason rejected", res.status === 400, `status ${res.status}`);

  res = await patch("PREPARING", { note: "QC failed — stone chipped, redo setting" });
  step("QC-fail → PREPARING with reason ok", res.status === 200, `status ${res.status}`);

  res = await patch("SHIPPED", { courierName: "DTDC", awbCode: "SEED-AWB-QC" });
  step("re-dispatch → SHIPPED", res.status === 200, `status ${res.status}`);

  await cleanupOrder(o.id);
}

// ── 19. FAILED_OTHER requires a reason note → offline refund mark → REFUNDED with ledger row ──
{
  const o = await seedOrder("PAYMENT_CONFIRMED");
  let res = await api(`/api/admin/orders/${o.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "FAILED_OTHER" }),
  });
  step("FAILED_OTHER without note rejected", res.status === 400, `status ${res.status}`);

  res = await api(`/api/admin/orders/${o.id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "FAILED_OTHER", note: "Item lost in transit before dispatch" }),
  });
  step("FAILED_OTHER with note ok", res.status === 200, `status ${res.status}`);

  res = await api(`/api/admin/orders/${o.id}/refund`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "full", reason: "Order failed — full offline refund" }),
  });
  const after = await prisma.order.findUnique({ where: { id: o.id }, include: { refunds: true } });
  step(
    "offline refund on FAILED_OTHER → REFUNDED with ledger row",
    res.status === 200 && after.status === "REFUNDED" && after.refunds.length === 1 &&
      after.refunds[0].method === "OFFLINE" && Number(after.refunds[0].amount) === 10000,
    JSON.stringify({ status: after.status, refunds: after.refunds.length }),
  );

  await cleanupOrder(o.id);
}

// ── 20. order notes: internal vs customer-visible on track-order; PATCH toggle ──
{
  const o = await seedOrder("PAYMENT_CONFIRMED");

  let res = await api(`/api/admin/orders/${o.id}/notes`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: "INTERNAL-ONLY-negotiated-discount-Zx91", internal: true }),
  });
  step("internal note created", res.status === 201, `status ${res.status}`);
  const internalNoteId = res.body?.id;

  res = await api(`/api/admin/orders/${o.id}/notes`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: "Your ring is being polished", internal: false }),
  });
  step("customer-visible note created", res.status === 201, `status ${res.status}`);
  const publicNoteId = res.body?.id;

  let track = await api("/api/track-order", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: o.id, email: EMAIL }),
  });
  let bodies = JSON.stringify(track.body);
  step(
    "track-order shows customer note, never the internal one",
    bodies.includes("being polished") && !bodies.includes("negotiated-discount-Zx91"),
  );

  res = await api(`/api/admin/orders/${o.id}/notes/${internalNoteId}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ internal: false }),
  });
  step("PATCH toggles internal note visible", res.status === 200, `status ${res.status}`);
  track = await api("/api/track-order", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: o.id, email: EMAIL }),
  });
  step("toggled note now visible on track-order", JSON.stringify(track.body).includes("negotiated-discount-Zx91"));

  res = await api(`/api/admin/orders/${o.id}/notes/${publicNoteId}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ internal: true }),
  });
  step("PATCH toggles public note internal", res.status === 200, `status ${res.status}`);
  track = await api("/api/track-order", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: o.id, email: EMAIL }),
  });
  step("toggled note now hidden from track-order", !JSON.stringify(track.body).includes("being polished"));

  await cleanupOrder(o.id);
}

// ── cleanup ──
await cleanupOrder(order.id);
console.log("      cleaned up test order");

await browser.close();
await prisma.$disconnect();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
