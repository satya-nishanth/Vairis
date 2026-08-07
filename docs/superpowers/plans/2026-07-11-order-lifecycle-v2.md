# Order Lifecycle v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete order lifecycle: delivery failures/RTO, customer returns, configurable refunds via a ledger, payment retry + expiry, WhatsApp notes, and auto-split of multi-item orders with parent-anchored payments.

**Architecture:** Single flat `OrderStatus` enum (17 states) with one transition map in `lib/orders.ts`; money moves recorded in an `OrderRefund` ledger with declared intent (no amount inference); multi-item orders auto-split into child orders at confirmation, payment stays on the parent forever. Spec: `docs/superpowers/specs/2026-07-11-order-lifecycle-v2-design.md`.

**Tech Stack:** Next.js 16 route handlers, Prisma 5 + Postgres (local Supabase), zod, Playwright-driven integration scripts (`scripts/_order-lifecycle-test.mjs` is the test harness — this project has no unit-test framework; TDD here = add failing scenario to the script, watch it fail, implement, watch it pass).

**Conventions for every task:**
- Test user: `nish99.sn@gmail.com` / `Admin1234!` (customer AND admin in local Supabase; dev server on `localhost:3000`, start with `npm run dev` if down).
- Verify battery: `npx tsc --noEmit && npx eslint app components lib`.
- Gateway is NOT configured locally — gateway paths are exercised via `scripts/_simulate-webhook.mjs` (HMAC-signed) and direct Prisma seeding, exactly as the existing lifecycle test does.

---

### Task 0: Schema v2 migration + status renames across the codebase

**Goal:** New enum values/renames, `OrderRefund`, `OrderNote`, `Order.parentOrderId`, `Shipment` 1-N — with every existing code reference updated so the tree compiles and the current 15-step lifecycle test still passes.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260711000000_lifecycle_v2/migration.sql`
- Modify (renames `PENDING→PAYMENT_PENDING`, `PROCESSING→PREPARING`): `lib/orders.ts`, `app/api/checkout/route.ts`, `lib/payments/webhook-handlers.ts`, `app/api/admin/orders/route.ts`, `app/api/admin/orders/[id]/route.ts`, `app/api/admin/orders/[id]/refund/route.ts`, `app/(admin)/admin/orders/page.tsx`, `app/(admin)/admin/orders/[id]/OrderActions.tsx`, `app/order-confirmation/page.tsx`, `scripts/_order-lifecycle-test.mjs`
- Modify (Shipment 1-N): `app/api/admin/orders/[id]/route.ts`, `app/account/orders/[id]/page.tsx`, `app/(admin)/admin/orders/[id]/page.tsx`, `app/api/track-order/route.ts`

**Acceptance Criteria:**
- [ ] `npx prisma migrate deploy` applies cleanly to local DB; `npx prisma generate` succeeds
- [ ] `grep -rn "'PENDING'\|\"PENDING\"\|'PROCESSING'\|\"PROCESSING\"" app components lib scripts` returns zero OrderStatus references (Razorpay `payment_capture` etc. unaffected)
- [ ] tsc + eslint clean; `node scripts/_order-lifecycle-test.mjs` 15/15 (script updated to new names)

**Verify:** `npx prisma migrate deploy && npx tsc --noEmit && node scripts/_order-lifecycle-test.mjs` → 15 passed

**Steps:**

- [ ] **Step 1: Update `prisma/schema.prisma`**

```prisma
enum OrderStatus {
  PAYMENT_PENDING
  PAYMENT_EXPIRED
  PAYMENT_CONFIRMED
  PREPARING
  SHIPPED
  OUT_FOR_DELIVERY
  DELIVERY_FAILED
  RETURNING_TO_ORIGIN
  RTO_RECEIVED
  DELIVERED
  DEPOSIT_REFUNDED
  RETURN_REQUESTED
  RETURN_IN_TRANSIT
  RETURN_RECEIVED
  CANCELLED
  REFUNDED
  SPLIT_INTO_DELIVERIES
}

enum RefundKind {
  DEPOSIT
  FULL
  PARTIAL
}

enum RefundMethod {
  GATEWAY
  OFFLINE
}

enum RefundStatus {
  INITIATED
  COMPLETED
}
```

On `Order` add (keep every existing field):

```prisma
  parentOrderId String?
  parent        Order?       @relation("OrderSplit", fields: [parentOrderId], references: [id])
  children      Order[]      @relation("OrderSplit")
  refunds       OrderRefund[]
  notes         OrderNote[]
  shipments     Shipment[]
```

Remove the old `shipment Shipment?` field. Replace the `Shipment` model:

```prisma
model Shipment {
  id           String    @id @default(cuid())
  orderId      String
  order        Order     @relation(fields: [orderId], references: [id])
  shiprocketId String?
  awbCode      String?
  courierName  String?
  trackingUrl  String?
  status       String?
  attempts     Int       @default(0)
  outcome      String?   // DELIVERED | FAILED | RTO — null while in flight
  dispatchedAt DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([orderId, dispatchedAt])
}
```

New models:

```prisma
model OrderRefund {
  id              String       @id @default(cuid())
  orderId         String
  order           Order        @relation(fields: [orderId], references: [id])
  amount          Decimal
  kind            RefundKind
  method          RefundMethod
  gatewayRefundId String?      @unique
  reason          String
  status          RefundStatus @default(INITIATED)
  createdAt       DateTime     @default(now())

  @@index([orderId])
}

model OrderNote {
  id        String   @id @default(cuid())
  orderId   String
  order     Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  author    String
  body      String
  internal  Boolean  @default(true)
  createdAt DateTime @default(now())

  @@index([orderId, createdAt])
}
```

- [ ] **Step 2: Write `prisma/migrations/20260711000000_lifecycle_v2/migration.sql`**

```sql
-- Lifecycle v2: status renames + new states, refund ledger, notes,
-- order splitting, shipments 1-per-dispatch.

-- Renames (atomic; existing rows follow automatically)
ALTER TYPE "OrderStatus" RENAME VALUE 'PENDING' TO 'PAYMENT_PENDING';
ALTER TYPE "OrderStatus" RENAME VALUE 'PROCESSING' TO 'PREPARING';

-- New states
ALTER TYPE "OrderStatus" ADD VALUE 'PAYMENT_EXPIRED';
ALTER TYPE "OrderStatus" ADD VALUE 'OUT_FOR_DELIVERY';
ALTER TYPE "OrderStatus" ADD VALUE 'DELIVERY_FAILED';
ALTER TYPE "OrderStatus" ADD VALUE 'RETURNING_TO_ORIGIN';
ALTER TYPE "OrderStatus" ADD VALUE 'RTO_RECEIVED';
ALTER TYPE "OrderStatus" ADD VALUE 'RETURN_REQUESTED';
ALTER TYPE "OrderStatus" ADD VALUE 'RETURN_IN_TRANSIT';
ALTER TYPE "OrderStatus" ADD VALUE 'RETURN_RECEIVED';
ALTER TYPE "OrderStatus" ADD VALUE 'SPLIT_INTO_DELIVERIES';
ALTER TYPE "OrderStatus" ADD VALUE 'FAILED_OTHER';

-- Refund ledger enums
CREATE TYPE "RefundKind" AS ENUM ('DEPOSIT', 'FULL', 'PARTIAL');
CREATE TYPE "RefundMethod" AS ENUM ('GATEWAY', 'OFFLINE');
CREATE TYPE "RefundStatus" AS ENUM ('INITIATED', 'COMPLETED');

-- Order: split support
ALTER TABLE "Order" ADD COLUMN "parentOrderId" TEXT;
ALTER TABLE "Order" ADD CONSTRAINT "Order_parentOrderId_fkey"
  FOREIGN KEY ("parentOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Shipment: one row per dispatch
ALTER TABLE "Shipment" DROP CONSTRAINT "Shipment_orderId_key";
ALTER TABLE "Shipment" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Shipment" ADD COLUMN "outcome" TEXT;
ALTER TABLE "Shipment" ADD COLUMN "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "Shipment_orderId_dispatchedAt_idx" ON "Shipment"("orderId", "dispatchedAt");

-- Refund ledger
CREATE TABLE "OrderRefund" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "kind" "RefundKind" NOT NULL,
    "method" "RefundMethod" NOT NULL,
    "gatewayRefundId" TEXT,
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'INITIATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderRefund_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrderRefund_gatewayRefundId_key" ON "OrderRefund"("gatewayRefundId");
CREATE INDEX "OrderRefund_orderId_idx" ON "OrderRefund"("orderId");
ALTER TABLE "OrderRefund" ADD CONSTRAINT "OrderRefund_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Notes
CREATE TABLE "OrderNote" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrderNote_orderId_createdAt_idx" ON "OrderNote"("orderId", "createdAt");
ALTER TABLE "OrderNote" ADD CONSTRAINT "OrderNote_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Run: `npx prisma migrate deploy && npx prisma generate`
Expected: "3 migrations found … applied 1 migration" then client generated.

- [ ] **Step 3: Mechanical renames.** In the files listed above replace OrderStatus string literals: `'PENDING'`→`'PAYMENT_PENDING'`, `'PROCESSING'`→`'PREPARING'` (single and double quoted; includes `status === "PENDING"` checks, zod enums, FILTERS array, `ADMIN_TRANSITIONS`/`OFFLINE_SETTLEMENT_TRANSITIONS` keys and values, event creates, and the lifecycle test script). Do NOT touch `payment_capture`, `PAYMENTS_NOT_CONFIGURED`, or Razorpay payload fields. Then update `lib/orders.ts` `ORDER_STATUS_META` keys `PENDING`→`PAYMENT_PENDING` (label "Payment Pending") and `PROCESSING`→`PREPARING` (label "Being Crafted") — full v2 map lands in Task 1; here only rename so tsc passes.

- [ ] **Step 4: Shipment 1-N call-site fixes.**
  - `app/api/admin/orders/[id]/route.ts`: `include: { shipment: true }` → `include: { shipments: { orderBy: { dispatchedAt: 'desc' } } }`; the SHIPPED branch replaces `tx.shipment.upsert` with `tx.shipment.create({ data: { orderId: id, courierName: courierName ?? null, awbCode: awbCode ?? null, trackingUrl: trackingUrl || null, status: 'IN_TRANSIT' } })`; DELIVERED branch updates the latest shipment: `const latest = order.shipments[0]; if (latest) await tx.shipment.update({ where: { id: latest.id }, data: { status: 'DELIVERED', outcome: 'DELIVERED' } })`.
  - `app/account/orders/[id]/page.tsx` + `app/api/track-order/route.ts` + admin detail page: `shipment` include → `shipments: { orderBy: { dispatchedAt: 'desc' } }`, read `order.shipments[0]` where a single shipment was used (admin detail additionally lists all rows — done properly in Task 3; here just make it compile with `[0]`).

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit && npx eslint app components lib && node scripts/_order-lifecycle-test.mjs`
Expected: clean, 15 passed.

```bash
git add -A && git commit -m "feat(orders): lifecycle v2 schema — status renames, refund ledger, notes, split FK, shipments 1-N"
```

---

### Task 1: `lib/orders.ts` v2 — complete state machine

**Goal:** One source of truth for all 17 states: labels, transition maps, reason requirements, terminal set.

**Files:**
- Modify: `lib/orders.ts` (replace maps/meta wholesale; keep `DEPOSIT_RATE`, `computeOrderAmounts`)

**Acceptance Criteria:**
- [ ] Every enum value has `ORDER_STATUS_META`; transition maps match spec §1 exactly
- [ ] `REASON_REQUIRED` covers DELIVERY_FAILED and RETURN_RECEIVED→PREPARING
- [ ] tsc + eslint clean

**Verify:** `npx tsc --noEmit && node -e "const o=require('./lib/orders.ts')" 2>/dev/null; npx tsc --noEmit` → clean (type-level check; runtime exercised in later tasks)

**Steps:**

- [ ] **Step 1: Replace the maps in `lib/orders.ts`** (after `computeOrderAmounts`, replacing existing META/TRANSITIONS/TIMELINE):

```typescript
export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; description: string; tone: "pending" | "active" | "done" | "bad" }
> = {
  PAYMENT_PENDING: { label: "Payment Pending", description: "Order created — awaiting payment.", tone: "pending" },
  PAYMENT_EXPIRED: { label: "Payment Expired", description: "Payment window closed. Place the order again anytime.", tone: "bad" },
  PAYMENT_CONFIRMED: { label: "Payment Confirmed", description: "Payment received. We're preparing your order.", tone: "active" },
  PREPARING: { label: "Being Crafted", description: "Your piece is being prepared and quality-checked.", tone: "active" },
  SHIPPED: { label: "Shipped", description: "On its way with insured delivery.", tone: "active" },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", description: "Arriving today — keep your phone handy for the courier.", tone: "active" },
  DELIVERY_FAILED: { label: "Delivery Attempt Failed", description: "The courier couldn't deliver. We'll retry or reach out.", tone: "pending" },
  RETURNING_TO_ORIGIN: { label: "Returning to Us", description: "The package is on its way back to us.", tone: "pending" },
  RTO_RECEIVED: { label: "Back With Us", description: "We've received the package back and will be in touch.", tone: "pending" },
  DELIVERED: { label: "Delivered", description: "Delivered. Your 5% security deposit refund is being processed.", tone: "done" },
  DEPOSIT_REFUNDED: { label: "Deposit Refunded", description: "5% security deposit refunded to your payment method.", tone: "done" },
  RETURN_REQUESTED: { label: "Return Requested", description: "We've received your return request and will confirm pickup.", tone: "pending" },
  RETURN_IN_TRANSIT: { label: "Return Pickup", description: "Your return is on its way back to us.", tone: "active" },
  RETURN_RECEIVED: { label: "Return Received", description: "We've received your return and it's being inspected.", tone: "active" },
  CANCELLED: { label: "Cancelled", description: "Order cancelled.", tone: "bad" },
  REFUNDED: { label: "Refunded", description: "Refund processed to your payment method.", tone: "bad" },
  SPLIT_INTO_DELIVERIES: { label: "Multiple Deliveries", description: "Your order ships as separate deliveries — track each below.", tone: "active" },
  FAILED_OTHER: { label: "Order Failed", description: "Something went wrong with this order — see the timeline. Any refund due is being processed.", tone: "bad" },
};

/** Admin-driven transitions (webhook/system transitions have their own endpoints). */
export const ADMIN_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PAYMENT_PENDING: ["CANCELLED"],
  PAYMENT_CONFIRMED: ["PREPARING", "CANCELLED", "FAILED_OTHER"],
  PREPARING: ["SHIPPED", "CANCELLED", "FAILED_OTHER"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED", "DELIVERY_FAILED", "FAILED_OTHER"],
  OUT_FOR_DELIVERY: ["DELIVERED", "DELIVERY_FAILED", "FAILED_OTHER"],
  DELIVERY_FAILED: ["OUT_FOR_DELIVERY", "RETURNING_TO_ORIGIN", "FAILED_OTHER"],
  RETURNING_TO_ORIGIN: ["RTO_RECEIVED", "FAILED_OTHER"],
  RTO_RECEIVED: ["PREPARING", "CANCELLED", "FAILED_OTHER"],
  DELIVERED: ["RETURN_REQUESTED", "FAILED_OTHER"],
  DEPOSIT_REFUNDED: ["RETURN_REQUESTED", "FAILED_OTHER"],
  RETURN_REQUESTED: ["RETURN_IN_TRANSIT", "DELIVERED", "DEPOSIT_REFUNDED", "FAILED_OTHER"], // DELIVERED/DEPOSIT_REFUNDED = reject/revert (server validates revert target)
  RETURN_IN_TRANSIT: ["RETURN_RECEIVED", "FAILED_OTHER"],
  RETURN_RECEIVED: ["PREPARING", "FAILED_OTHER"], // QC fail → re-dispatch; QC pass goes through the refund endpoint
};

/** Extra manual marks for OFFLINE orders only (no gateway payment). */
export const OFFLINE_SETTLEMENT_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PAYMENT_PENDING: ["PAYMENT_CONFIRMED"],
  DELIVERED: ["DEPOSIT_REFUNDED"],
  CANCELLED: ["REFUNDED"],
  RETURN_RECEIVED: ["REFUNDED"],
  FAILED_OTHER: ["REFUNDED"],
};

/** from→to pairs whose PATCH requires a non-empty note. */
export const REASON_REQUIRED: [OrderStatus, OrderStatus][] = [
  ["SHIPPED", "DELIVERY_FAILED"],
  ["OUT_FOR_DELIVERY", "DELIVERY_FAILED"],
  ["RETURN_RECEIVED", "PREPARING"],
];

/** Statuses that ALWAYS require a reason note when transitioned into. */
export const REASON_REQUIRED_TARGETS: OrderStatus[] = ["FAILED_OTHER"];

export const TIMELINE_STEPS: OrderStatus[] = [
  "PAYMENT_CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "DEPOSIT_REFUNDED",
];

/** Orders in these states render the event-log timeline instead of happy-path steps. */
export function isHappyPath(status: OrderStatus): boolean {
  return (TIMELINE_STEPS as string[]).includes(status) || status === "PAYMENT_PENDING";
}
```

- [ ] **Step 2: Fix `components/commerce/OrderTimeline.tsx`** — replace `const terminal = status === "CANCELLED" || status === "REFUNDED";` with `const terminal = !isHappyPath(status);` (import from `@/lib/orders`).

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit && npx eslint app components lib && node scripts/_order-lifecycle-test.mjs`
Expected: clean, 15 passed (existing transitions unchanged by the superset map).

```bash
git add -A && git commit -m "feat(orders): full v2 state machine maps + timeline fallback"
```

---

### Task 2: Refund ledger service + webhook intent matching + late-capture guard

**Goal:** All refunds flow through `OrderRefund` rows with declared intent; webhook matches by id (no amount inference); capture on a dead order auto-refunds.

**Files:**
- Create: `lib/refunds.ts`
- Modify: `app/api/admin/orders/[id]/refund/route.ts`, `lib/payments/webhook-handlers.ts`
- Modify: `scripts/_order-lifecycle-test.mjs` (scenario extensions)

**Acceptance Criteria:**
- [ ] `initiateRefund` handles gateway (parent-walk for children) and offline; caps at remaining captured; mandatory reason
- [ ] `refund.processed` resolves the ledger row by `gatewayRefundId`; status flip per `kind` (DEPOSIT→DEPOSIT_REFUNDED; FULL→REFUNDED; PARTIAL→REFUNDED only when order is CANCELLED or RETURN_RECEIVED, else status unchanged)
- [ ] capture webhook on PAYMENT_EXPIRED/CANCELLED never confirms: records capture, creates FULL refund ledger row + gateway refund, writes alert event
- [ ] lifecycle test extended + green

**Verify:** `node scripts/_order-lifecycle-test.mjs` → all pass (new scenarios included)

**Steps:**

- [ ] **Step 1: Create `lib/refunds.ts`**

```typescript
import { prisma } from "@/lib/prisma";
import { getPaymentGateway } from "@/lib/payments";
import type { OrderStatus, RefundKind } from "@prisma/client";

/**
 * Refund ledger — every rupee returned (gateway or offline) is an OrderRefund
 * row with DECLARED intent. The refund.processed webhook matches rows by
 * gatewayRefundId and applies that intent; amounts are never inferred.
 * For split children the gateway payment lives on the PARENT (spec §5) —
 * resolvePayment walks up.
 */

export async function resolvePayment(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true, parent: { include: { payment: true } } },
  });
  if (!order) return null;
  return { order, payment: order.payment ?? order.parent?.payment ?? null };
}

/** Total captured available to this order (child = its own grandTotal slice). */
export function capturedFor(order: { grandTotal: unknown }): number {
  return Number(order.grandTotal);
}

export async function refundedSoFar(orderId: string): Promise<number> {
  const rows = await prisma.orderRefund.findMany({ where: { orderId } });
  return rows.reduce((s, r) => s + Number(r.amount), 0);
}

export function statusAfterRefund(kind: RefundKind, current: OrderStatus): OrderStatus | null {
  if (kind === "DEPOSIT") return "DEPOSIT_REFUNDED";
  if (kind === "FULL") return "REFUNDED";
  // PARTIAL settles the order only where a refund is the resolution step
  return current === "CANCELLED" || current === "RETURN_RECEIVED" || current === "FAILED_OTHER"
    ? "REFUNDED"
    : null;
}

export async function initiateRefund(params: {
  orderId: string;
  kind: RefundKind;
  amount?: number;
  reason: string;
}): Promise<{ ok: true; amount: number } | { ok: false; error: string; code: number }> {
  const resolved = await resolvePayment(params.orderId);
  if (!resolved) return { ok: false, error: "Order not found", code: 404 };
  const { order, payment } = resolved;

  const already = await refundedSoFar(order.id);
  const remaining = capturedFor(order) - already;

  const amount =
    params.kind === "DEPOSIT"
      ? Number(order.depositAmount)
      : params.kind === "FULL"
        ? remaining
        : Math.round(params.amount ?? 0);

  if (!params.reason.trim()) return { ok: false, error: "Reason is required", code: 400 };
  if (amount <= 0) return { ok: false, error: "Nothing to refund", code: 409 };
  if (amount > remaining + 0.01)
    return { ok: false, error: `Exceeds remaining refundable ₹${remaining.toLocaleString("en-IN")}`, code: 409 };
  if (params.kind === "DEPOSIT") {
    if (order.status !== "DELIVERED")
      return { ok: false, error: "Deposit refunds happen after delivery", code: 409 };
    const priorDeposit = await prisma.orderRefund.findFirst({
      where: { orderId: order.id, kind: "DEPOSIT" },
    });
    if (priorDeposit) return { ok: false, error: "Deposit already refunded", code: 409 };
  }

  // OFFLINE order (no gateway payment anywhere): ledger row + immediate transition mark.
  if (!payment?.razorpayPaymentId) {
    const next = statusAfterRefund(params.kind, order.status);
    await prisma.$transaction([
      prisma.orderRefund.create({
        data: {
          orderId: order.id,
          amount,
          kind: params.kind,
          method: "OFFLINE",
          reason: params.reason,
          status: "COMPLETED",
        },
      }),
      ...(next
        ? [
            prisma.order.update({
              where: { id: order.id },
              data: {
                status: next,
                events: {
                  create: {
                    status: next,
                    note: `₹${amount.toLocaleString("en-IN")} returned offline — ${params.reason}`,
                  },
                },
              },
            }),
          ]
        : [
            prisma.orderEvent.create({
              data: {
                orderId: order.id,
                status: order.status,
                note: `₹${amount.toLocaleString("en-IN")} returned offline — ${params.reason}`,
              },
            }),
          ]),
    ]);
    return { ok: true, amount };
  }

  // GATEWAY: create the gateway refund, record INITIATED intent; the
  // refund.processed webhook completes it and flips the status.
  const gateway = getPaymentGateway();
  if (!gateway.isConfigured())
    return { ok: false, error: `Payment gateway (${gateway.name}) not configured`, code: 503 };

  let gatewayRefundId: string;
  try {
    const result = await gateway.createRefund(payment.razorpayPaymentId, amount, {
      order_id: order.id,
      reason: params.reason.slice(0, 250),
    });
    gatewayRefundId = result.gatewayRefundId;
  } catch (err) {
    console.error("refund initiation failed", err);
    return { ok: false, error: "Gateway refused the refund — check the gateway dashboard", code: 502 };
  }

  await prisma.$transaction([
    prisma.orderRefund.create({
      data: { orderId: order.id, amount, kind: params.kind, method: "GATEWAY", gatewayRefundId, reason: params.reason },
    }),
    prisma.orderEvent.create({
      data: {
        orderId: order.id,
        status: order.status,
        note: `Refund of ₹${amount.toLocaleString("en-IN")} initiated — ${params.reason}`,
      },
    }),
  ]);
  return { ok: true, amount };
}
```

- [ ] **Step 2: Rewrite `app/api/admin/orders/[id]/refund/route.ts`** to a thin wrapper:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { initiateRefund } from '@/lib/refunds'

export const dynamic = 'force-dynamic'

const refundSchema = z.object({
  kind: z.enum(['deposit', 'full', 'partial']),
  amount: z.number().positive().optional(),
  reason: z.string().trim().min(3, 'Reason is required'),
})

/**
 * POST /api/admin/orders/[id]/refund — start a refund via the ledger
 * (lib/refunds.ts). Gateway refunds complete via the refund.processed
 * webhook; offline refunds are marked complete immediately.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const parsed = refundSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid refund' }, { status: 400 })
  }

  const result = await initiateRefund({
    orderId: id,
    kind: parsed.data.kind.toUpperCase() as 'DEPOSIT' | 'FULL' | 'PARTIAL',
    amount: parsed.data.amount,
    reason: parsed.data.reason,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.code })
  return NextResponse.json({ ok: true, amount: result.amount })
}
```

- [ ] **Step 3: Rewrite refund + capture handling in `lib/payments/webhook-handlers.ts`.** Replace `handleRefundProcessed` entirely:

```typescript
async function handleRefundProcessed(
  gatewayPaymentId: string,
  gatewayRefundId: string,
  amount: number,
) {
  // Ledger-matched: the initiation declared the intent; apply it verbatim.
  const ledger = await prisma.orderRefund.findUnique({ where: { gatewayRefundId } });
  if (!ledger) {
    console.error(`refund.processed for unknown refund ${gatewayRefundId} — record manually`);
    return;
  }
  if (ledger.status === "COMPLETED") return; // duplicate delivery

  const order = await prisma.order.findUnique({ where: { id: ledger.orderId } });
  if (!order) return;
  const next = statusAfterRefund(ledger.kind, order.status);

  const payment = await prisma.payment.findFirst({ where: { razorpayPaymentId: gatewayPaymentId } });

  await prisma.$transaction([
    prisma.orderRefund.update({ where: { id: ledger.id }, data: { status: "COMPLETED" } }),
    ...(payment
      ? [
          prisma.payment.update({
            where: { id: payment.id },
            data: {
              razorpayRefundId: gatewayRefundId,
              refundedAmount: Number(payment.refundedAmount) + amount,
              status:
                Number(payment.refundedAmount) + amount >= Number(payment.amount) - 0.01
                  ? "REFUNDED"
                  : "PARTIALLY_REFUNDED",
            },
          }),
        ]
      : []),
    ...(next
      ? [
          prisma.order.update({
            where: { id: order.id },
            data: {
              status: next,
              events: {
                create: { status: next, note: `₹${amount.toLocaleString("en-IN")} refund completed` },
              },
            },
          }),
        ]
      : [
          prisma.orderEvent.create({
            data: { orderId: order.id, status: order.status, note: `₹${amount.toLocaleString("en-IN")} refund completed` },
          }),
        ]),
  ]);
}
```

Import `statusAfterRefund`, `initiateRefund` from `@/lib/refunds`. Then guard `confirmPayment` (top, after payment lookup):

```typescript
  // Late capture on a dead order: never resurrect — refund in full instead.
  if (payment.order.status === "PAYMENT_EXPIRED" || payment.order.status === "CANCELLED") {
    if (payment.status !== "CAPTURED") {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "CAPTURED", razorpayPaymentId: gatewayPaymentId },
      });
      await prisma.orderEvent.create({
        data: {
          orderId: payment.orderId,
          status: payment.order.status,
          note: "⚠ Payment received after order expiry/cancellation — auto-refund initiated",
        },
      });
      await initiateRefund({
        orderId: payment.orderId,
        kind: "FULL",
        reason: "Automatic: payment captured after order expired/cancelled",
      });
    }
    return { orderId: payment.orderId, userId: payment.order.userId };
  }
```

- [ ] **Step 4: Extend lifecycle test** — add after the existing deposit-refund scenario (gateway refund path uses a directly-seeded ledger row since the gateway isn't configured locally):

```javascript
// ── ledger-matched refund webhook ──
{
  const refundId = `rfnd_LEDGER${Date.now()}`;
  await prisma.orderRefund.create({
    data: { orderId: order.id, amount: grandTotal - total, kind: 'DEPOSIT', method: 'GATEWAY', gatewayRefundId: refundId, reason: 'test deposit', status: 'INITIATED' },
  });
  const res = await postWebhook({
    event: 'refund.processed',
    payload: { refund: { entity: { id: refundId, payment_id: gwPaymentId, amount: (grandTotal - total) * 100 } } },
  });
  const after = await prisma.order.findUnique({ where: { id: order.id } });
  const row = await prisma.orderRefund.findUnique({ where: { gatewayRefundId: refundId } });
  step('refund.processed matches ledger intent', res.status === 200 && after.status === 'DEPOSIT_REFUNDED' && row.status === 'COMPLETED');
  // duplicate delivery is a no-op
  await postWebhook({ event: 'refund.processed', payload: { refund: { entity: { id: refundId, payment_id: gwPaymentId, amount: (grandTotal - total) * 100 } } } });
  const events = await prisma.orderEvent.count({ where: { orderId: order.id, status: 'DEPOSIT_REFUNDED' } });
  step('duplicate refund webhook idempotent', events === 1);
}
```

(Replace the old inference-based refund scenario — delete the direct `refund` simulation without a ledger row, it now logs "unknown refund" by design.)

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit && npx eslint app components lib && node scripts/_order-lifecycle-test.mjs`

```bash
git add -A && git commit -m "feat(orders): refund ledger with declared intent + late-capture auto-refund"
```

---

### Task 3: Shipments per dispatch — attempts, outcomes, history

**Goal:** DELIVERY_FAILED counts attempts; RTO marks outcome; re-dispatch creates fresh rows; admin sees all shipments, customer sees latest.

**Files:**
- Modify: `app/api/admin/orders/[id]/route.ts`, `app/(admin)/admin/orders/[id]/page.tsx`, `app/account/orders/[id]/page.tsx`

**Acceptance Criteria:**
- [ ] SHIPPED always creates a new Shipment row (re-dispatch = second row)
- [ ] DELIVERY_FAILED → latest shipment `attempts + 1`; RETURNING_TO_ORIGIN → latest `outcome: 'RTO'`; DELIVERED → latest `outcome: 'DELIVERED', status: 'DELIVERED'`
- [ ] Admin detail lists every shipment (courier, AWB, attempts, outcome, dispatchedAt); customer page shows the latest only

**Verify:** lifecycle test Task 9 scenarios cover this; interim: `npx tsc --noEmit` clean + manual PATCH sequence via test script additions in Task 9

**Steps:**

- [ ] **Step 1: In the PATCH route's `$transaction`,** after the order update, add:

```typescript
    const latest = order.shipments[0] ?? null

    if (nextStatus === 'DELIVERY_FAILED' && latest) {
      await tx.shipment.update({
        where: { id: latest.id },
        data: { attempts: { increment: 1 }, status: 'ATTEMPT_FAILED' },
      })
    }

    if (nextStatus === 'RETURNING_TO_ORIGIN' && latest) {
      await tx.shipment.update({
        where: { id: latest.id },
        data: { outcome: 'RTO', status: 'RETURNING_TO_ORIGIN' },
      })
    }
```

(the SHIPPED create + DELIVERED update blocks already landed in Task 0 Step 4).

- [ ] **Step 2: Admin detail page** — replace the single-shipment block with a list over `order.shipments` (already ordered desc): each row shows `courierName · AWB · attempts N · outcome ?? 'in flight' · dispatchedAt.toLocaleDateString('en-IN')` plus tracking link when present.

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit && npx eslint app components lib`

```bash
git add -A && git commit -m "feat(orders): shipment attempts/outcomes + full dispatch history in admin"
```

---

### Task 4: Transition API expansion + admin OrderActions v2

**Goal:** PATCH accepts every §1 transition with reason enforcement and return-reject revert validation; admin UI grows reason input + new buttons.

**Files:**
- Modify: `app/api/admin/orders/[id]/route.ts`, `app/(admin)/admin/orders/[id]/OrderActions.tsx`, `app/(admin)/admin/orders/page.tsx` (FILTERS list → add new statuses)

**Acceptance Criteria:**
- [ ] zod status enum = all admin-reachable statuses; allowed-move check uses Task 1 maps
- [ ] DELIVERY_FAILED / RETURN_RECEIVED→PREPARING rejected without `note` (400)
- [ ] RETURN_REQUESTED revert only to the exact pre-request status (409 otherwise)
- [ ] OrderActions renders reason textarea when the chosen transition requires it; refund button opens kind/amount/reason mini-form (deposit prefill, full prefill = remaining, partial free amount)

**Verify:** exercised end-to-end by Task 9 scenarios; interim `npx tsc --noEmit && npx eslint app components lib`

**Steps:**

- [ ] **Step 1: PATCH route.** Expand the zod enum:

```typescript
  status: z.enum([
    'PAYMENT_CONFIRMED', 'PREPARING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED',
    'DELIVERY_FAILED', 'RETURNING_TO_ORIGIN', 'RTO_RECEIVED',
    'RETURN_REQUESTED', 'RETURN_IN_TRANSIT',
    'DEPOSIT_REFUNDED', 'CANCELLED', 'REFUNDED', 'FAILED_OTHER',
  ]),
```

After the allowed-move check add:

```typescript
  // Reason enforcement (lib/orders REASON_REQUIRED)
  const reasonRequired =
    REASON_REQUIRED.some(([f, t]) => f === order.status && t === nextStatus) ||
    REASON_REQUIRED_TARGETS.includes(nextStatus)
  if (reasonRequired && !note?.trim()) {
    return NextResponse.json({ error: 'A reason note is required for this transition' }, { status: 400 })
  }

  // Return-request reject must revert to the exact pre-request status
  if (order.status === 'RETURN_REQUESTED' && (nextStatus === 'DELIVERED' || nextStatus === 'DEPOSIT_REFUNDED')) {
    const events = await prisma.orderEvent.findMany({ where: { orderId: id }, orderBy: { createdAt: 'desc' } })
    const requestIdx = events.findIndex((e) => e.status === 'RETURN_REQUESTED')
    const prior = events.slice(requestIdx + 1).find((e) => e.status !== 'RETURN_REQUESTED')?.status
    if (prior !== nextStatus) {
      return NextResponse.json({ error: `Reject must revert to ${prior ?? 'the previous status'}` }, { status: 409 })
    }
  }
```

Note additions to `eventNote` defaults: `RETURN_REQUESTED` → 'Return requested (admin)', `RETURN_IN_TRANSIT` → 'Return pickup arranged', `RTO_RECEIVED` → 'Package received back at origin', `RETURNING_TO_ORIGIN` → 'Package returning to origin', `OUT_FOR_DELIVERY` → 'Out for delivery'.

- [ ] **Step 2: OrderActions v2.** Add state `const [reason, setReason] = useState('')` and a `needsReason(next)` helper reading `REASON_REQUIRED` (import). Transition click with `needsReason` and empty reason → show textarea + "Confirm" (same two-step pattern as the ship form). PATCH body gains `note: reason || undefined`. Replace the two refund buttons with one "Refund…" button toggling a mini-form: `kind` select (deposit — only offered when status DELIVERED and deposit>0 and not yet deposit-refunded; full; partial), `amount` number input (disabled for deposit/full, prefilled `depositAmount`/`remaining = grandTotal − refundedSoFar` passed as new props `refundedTotal`), required `reason` text input, POST `{ kind, amount, reason }`. Keep the `offline` prop behavior: offline orders still get settlement marks via transitions; refund mini-form for offline calls the same endpoint (ledger handles OFFLINE path).

- [ ] **Step 3: Detail page props** — in the admin detail page (server component) compute:

```typescript
const refundedTotal = Number(
  (await prisma.orderRefund.aggregate({ where: { orderId: order.id }, _sum: { amount: true } }))._sum.amount ?? 0,
)
```

pass `refundedTotal={refundedTotal}` to `OrderActions` (new prop, used for the "full" prefill = `Number(order.grandTotal) - refundedTotal`); also render a "Refunds" card listing `order.refunds` (amount, kind, method, status, reason, date) — add `refunds: { orderBy: { createdAt: 'desc' } }` to the page's include.

- [ ] **Step 4: Orders list FILTERS** — extend array with `'DELIVERY_FAILED', 'RETURNING_TO_ORIGIN', 'RTO_RECEIVED', 'RETURN_REQUESTED', 'RETURN_IN_TRANSIT', 'RETURN_RECEIVED', 'PAYMENT_EXPIRED', 'SPLIT_INTO_DELIVERIES', 'FAILED_OTHER'`.

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit && npx eslint app components lib`

```bash
git add -A && git commit -m "feat(admin): full v2 transitions with reason enforcement + refund form"
```

---

### Task 5: Payment retry + expiry sweep

**Goal:** Customers retry payment on the same order; stale unpaid orders expire automatically.

**Files:**
- Create: `app/api/orders/[id]/retry-payment/route.ts`, `app/api/admin/sweep-orders/route.ts`
- Modify: `app/account/orders/[id]/page.tsx` (Retry button via small client component), Create: `app/account/orders/[id]/RetryPaymentButton.tsx`
- Modify: `.env.local` (`ORDER_SWEEP_SECRET=dev-local-sweep-secret`), `scripts/_order-lifecycle-test.mjs`

**Acceptance Criteria:**
- [ ] retry endpoint: own order + PAYMENT_PENDING + gateway configured → returns `{ gateway, clientParams, contact }` reusing the stored `razorpayOrderId`; 409 otherwise
- [ ] sweep: Bearer-authed; PAYMENT_PENDING older than `ORDER_EXPIRY_HOURS` (default 24) → PAYMENT_EXPIRED + event; skips CAPTURED payments; returns count
- [ ] lifecycle test: sweep expires an old seeded order, skips a captured one; late capture on expired auto-refunds (ledger row created, alert event present)

**Verify:** `node scripts/_order-lifecycle-test.mjs` → new scenarios pass

**Steps:**

- [ ] **Step 1: `app/api/orders/[id]/retry-payment/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPaymentGateway } from '@/lib/payments'

export const dynamic = 'force-dynamic'

/**
 * POST /api/orders/[id]/retry-payment — relaunch the gateway checkout for a
 * customer's own PAYMENT_PENDING order. Reuses the ORIGINAL gateway order id
 * (Razorpay orders accept multiple attempts) so the price stays locked as
 * created; the 24h sweep (app/api/admin/sweep-orders) bounds the window.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  const { id } = await params
  const gateway = getPaymentGateway()

  const order = await prisma.order.findUnique({ where: { id }, include: { payment: true } })
  if (!order || order.userId !== user.id) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status !== 'PAYMENT_PENDING' || !order.payment) {
    return NextResponse.json({ error: 'This order is not awaiting payment' }, { status: 409 })
  }
  if (!gateway.isConfigured() || !gateway.publicKey()) {
    return NextResponse.json({ error: 'PAYMENTS_NOT_CONFIGURED' }, { status: 503 })
  }

  return NextResponse.json({
    orderId: order.id,
    gateway: gateway.name,
    clientParams: {
      key: gateway.publicKey(),
      order_id: order.payment.razorpayOrderId,
      amount: Math.round(Number(order.payment.amount) * 100),
      currency: 'INR',
    },
    contact: { name: order.contactName, phone: order.contactPhone, email: user.email },
  })
}
```

- [ ] **Step 2: `app/api/admin/sweep-orders/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/sweep-orders — expire stale unpaid orders.
 * Cron-called (GitHub Actions hourly — never Vercel cron), Bearer-authed
 * with ORDER_SWEEP_SECRET. Race-safe: any order whose payment is CAPTURED
 * is left for the capture webhook even if it looks stale.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.ORDER_SWEEP_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const hours = Number(process.env.ORDER_EXPIRY_HOURS ?? 24)
  const cutoff = new Date(Date.now() - hours * 3600_000)

  const stale = await prisma.order.findMany({
    where: { status: 'PAYMENT_PENDING', createdAt: { lt: cutoff } },
    include: { payment: { select: { status: true } } },
  })

  let expired = 0
  for (const order of stale) {
    if (order.payment?.status === 'CAPTURED') continue // capture webhook owns it
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'PAYMENT_EXPIRED',
        events: { create: { status: 'PAYMENT_EXPIRED', note: `No payment within ${hours}h — order expired` } },
      },
    })
    expired++
  }

  return NextResponse.json({ ok: true, checked: stale.length, expired })
}
```

- [ ] **Step 3: `RetryPaymentButton.tsx`** — client component: loads Razorpay script (`next/script` lazyOnload), on click POSTs retry-payment, on 503 shows the "payment setup in progress" line, otherwise launches the same Razorpay flow as checkout (copy `launchGatewayCheckout` shape from `app/checkout/page.tsx`, success handler → `/api/payment/verify` then `router.refresh()`). Render it in the customer order detail page when `order.status === 'PAYMENT_PENDING'` alongside a "complete your payment" note.

- [ ] **Step 4: Env + test scenarios.** Append `ORDER_SWEEP_SECRET=dev-local-sweep-secret` to `.env.local` (restart dev server). Lifecycle test additions:

```javascript
// ── sweep + late capture ──
{
  const old = await prisma.order.create({ data: { userId: user.id, status: 'PAYMENT_PENDING', totalAmount: 1000, depositAmount: 50, grandTotal: 1050, contactName: 'x', contactPhone: '9999999999', addressLine1: 'a street 1', city: 'B', state: 'K', pincode: '560001', createdAt: new Date(Date.now() - 30 * 3600_000), events: { create: { status: 'PAYMENT_PENDING', note: 'seed' } } } });
  const oldGw = `order_SWEEP${Date.now()}`;
  await prisma.payment.create({ data: { orderId: old.id, razorpayOrderId: oldGw, status: 'CREATED', amount: 1050 } });
  const res = await fetch(`${BASE}/api/admin/sweep-orders`, { method: 'POST', headers: { Authorization: 'Bearer dev-local-sweep-secret' } });
  const after = await prisma.order.findUnique({ where: { id: old.id } });
  step('sweep expires stale unpaid order', res.status === 200 && after.status === 'PAYMENT_EXPIRED');

  // late capture on the expired order → auto-refund intent (gateway unconfigured locally
  // → initiateRefund returns 503 internally; assert the alert event landed)
  await postWebhook({ event: 'payment.captured', payload: { payment: { entity: { id: `pay_LATE${Date.now()}`, order_id: oldGw } } } });
  const alert = await prisma.orderEvent.findFirst({ where: { orderId: old.id, note: { contains: 'after order expiry' } } });
  const stillDead = await prisma.order.findUnique({ where: { id: old.id } });
  step('late capture never resurrects the order', !!alert && stillDead.status === 'PAYMENT_EXPIRED');
  // cleanup
  await prisma.orderEvent.deleteMany({ where: { orderId: old.id } });
  await prisma.orderRefund.deleteMany({ where: { orderId: old.id } });
  await prisma.payment.deleteMany({ where: { orderId: old.id } });
  await prisma.order.delete({ where: { id: old.id } });
}
```

- [ ] **Step 5: Verify + commit**

Run: `node scripts/_order-lifecycle-test.mjs` → all pass.

```bash
git add -A && git commit -m "feat(orders): payment retry on same order + expiry sweep endpoint"
```

---

### Task 6: Auto-split with payment anchoring

**Goal:** Multi-item orders split into one child per line item at confirmation; payment stays on the parent; proration exact; parent/child rendering everywhere.

**Files:**
- Create: `lib/split.ts`
- Modify: `lib/payments/webhook-handlers.ts` (call split inside confirmation), `app/api/admin/orders/route.ts` (manual multi-item creation), `app/account/orders/page.tsx`, `app/account/orders/[id]/page.tsx`, `app/(admin)/admin/orders/[id]/page.tsx`, `app/api/track-order/route.ts`

**Acceptance Criteria:**
- [ ] confirmed order with ≥2 OrderItems → children created atomically, parent → SPLIT_INTO_DELIVERIES; single-item unaffected
- [ ] Σ children (totalAmount, depositAmount, grandTotal) == parent exactly; last child absorbs remainders
- [ ] child refunds resolve the parent payment (already generic via Task 2 `resolvePayment`)
- [ ] customer parent page lists each child with its own timeline link; children appear in My Orders; track-order on a parent id returns children summaries
- [ ] admin child page links to parent payment; parent page lists children + money rollup

**Verify:** Task 9 auto-split scenarios; interim tsc/eslint clean

**Steps:**

- [ ] **Step 1: `lib/split.ts`**

```typescript
import type { Prisma } from "@prisma/client";

/**
 * Auto-split (spec §5): any confirmed order with ≥2 line items becomes one
 * child order per line item. Jewellery pieces are crafted on independent
 * schedules and never deliver together — splitting is a deterministic rule.
 *
 * PAYMENT ANCHORING: the Payment row stays on the PARENT forever. Children
 * carry prorated amounts and parentOrderId; money actions on children walk
 * up via lib/refunds.resolvePayment.
 *
 * Runs INSIDE the caller's transaction (tx) so confirmation + split are atomic.
 */
export async function autoSplitOrder(tx: Prisma.TransactionClient, orderId: string): Promise<string[]> {
  const parent = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!parent || parent.items.length < 2 || parent.parentOrderId) return [];

  const parentGoods = Number(parent.totalAmount);
  const parentDeposit = Number(parent.depositAmount);
  const parentGrand = Number(parent.grandTotal);

  // Prorate; last child absorbs rounding remainders so sums match exactly.
  let usedDeposit = 0;
  let usedGrand = 0;
  const childIds: string[] = [];

  for (let i = 0; i < parent.items.length; i++) {
    const item = parent.items[i];
    const goods = Number(item.price) * item.quantity;
    const last = i === parent.items.length - 1;
    const deposit = last ? parentDeposit - usedDeposit : Math.round(parentDeposit * (goods / parentGoods));
    const grand = last ? parentGrand - usedGrand : goods + deposit;
    usedDeposit += deposit;
    usedGrand += grand;

    const child = await tx.order.create({
      data: {
        userId: parent.userId,
        parentOrderId: parent.id,
        status: "PAYMENT_CONFIRMED",
        totalAmount: goods,
        depositAmount: deposit,
        grandTotal: grand,
        contactName: parent.contactName,
        contactPhone: parent.contactPhone,
        addressLine1: parent.addressLine1,
        addressLine2: parent.addressLine2,
        city: parent.city,
        state: parent.state,
        pincode: parent.pincode,
        events: {
          create: {
            status: "PAYMENT_CONFIRMED",
            note: `Delivery ${i + 1} of ${parent.items.length} — split from order ${parent.id}`,
          },
        },
      },
    });
    // Move the line item to the child (parent keeps the receipt via events + payment)
    await tx.orderItem.update({ where: { id: item.id }, data: { orderId: child.id } });
    childIds.push(child.id);
  }

  await tx.order.update({
    where: { id: parent.id },
    data: {
      status: "SPLIT_INTO_DELIVERIES",
      events: {
        create: {
          status: "SPLIT_INTO_DELIVERIES",
          note: `Split into ${childIds.length} deliveries: ${childIds.join(", ")}`,
        },
      },
    },
  });

  return childIds;
}
```

(Design note documented in code: items MOVE to children so per-child pages/refund prefills work off their own items; the parent's split event + payment row remain the receipt. Invariant check: after the loop `usedDeposit === parentDeposit && usedGrand === parentGrand` by construction.)

- [ ] **Step 2: Hook into confirmation.** In `confirmPayment` (webhook-handlers), convert the `$transaction([...])` array form into `prisma.$transaction(async (tx) => { ... })` doing the same three writes, then `await autoSplitOrder(tx, payment.orderId)` last. Keep idempotency: the early-return when `payment.status === 'CAPTURED'` already prevents double-split; `autoSplitOrder` additionally no-ops on `parentOrderId` set or <2 items.

- [ ] **Step 3: Manual orders.** In `app/api/admin/orders/route.ts` POST, after `prisma.order.create`, when `d.items.length >= 2`: wrap creation in `prisma.$transaction(async (tx) => { ...create..., const children = await autoSplitOrder(tx, order.id); return { order, children } })` and respond `{ orderId, childOrderIds }`. (For a PAYMENT_PENDING manual order, split still happens at creation — offline flows confirm per child with settlement marks.)

- [ ] **Step 4: Rendering.**
  - Customer `orders/[id]`: if `status === 'SPLIT_INTO_DELIVERIES'`, fetch `children: { include: { items: true, events: true, shipments: ... } }` and render "Delivery N" cards — each child's chip, items, `OrderTimeline`, link to its own page. Parent shows the combined Payment Summary (its grandTotal, deposit note).
  - Customer `orders` list: children render as normal rows (they're orders); parent row shows "N deliveries" instead of an amount breakdown.
  - Admin child page: banner `Payment via parent {parentOrderId} →` link when `order.parentOrderId`; admin parent page: children table (id, status, goods, deposit, refunded) + rollup line `captured X · refunded Y · remaining Z` (aggregate `OrderRefund` over child ids).
  - `track-order`: when the matched order is a parent, include `children: [{ orderId, status, events }]` in the response and render child timelines on the track page (reuse the same component per child).

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit && npx eslint app components lib`

```bash
git add -A && git commit -m "feat(orders): auto-split multi-item orders with parent-anchored payment"
```

---

### Task 7: Customer returns

**Goal:** Request-return button within the window; admin approve/reject; QC resolution paths (refund via Task 2 / re-dispatch via Task 4).

**Files:**
- Create: `app/api/orders/[id]/return-request/route.ts`, `app/account/orders/[id]/ReturnRequestButton.tsx`
- Modify: `app/account/orders/[id]/page.tsx`

**Acceptance Criteria:**
- [ ] POST allowed only for own order in DELIVERED/DEPOSIT_REFUNDED within `RETURN_WINDOW_DAYS` (default 7) of the DELIVERED event; 409 outside window/state
- [ ] transition → RETURN_REQUESTED + event with customer's reason
- [ ] button renders only when eligible (server computes `returnEligibleUntil` and passes it down); shows deadline date

**Verify:** Task 9 scenarios; interim tsc/eslint

**Steps:**

- [ ] **Step 1: `app/api/orders/[id]/return-request/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const schema = z.object({ reason: z.string().trim().min(5, 'Tell us briefly why') })

/**
 * POST /api/orders/[id]/return-request — customer-initiated return
 * ("Easy Returns"). Window: RETURN_WINDOW_DAYS (default 7) from the
 * DELIVERED event. Admin approves pickup / rejects from the order page.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  const { id } = await params

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })

  const order = await prisma.order.findUnique({
    where: { id },
    include: { events: { where: { status: 'DELIVERED' }, orderBy: { createdAt: 'desc' }, take: 1 } },
  })
  if (!order || order.userId !== user.id) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status !== 'DELIVERED' && order.status !== 'DEPOSIT_REFUNDED') {
    return NextResponse.json({ error: 'This order is not eligible for a return' }, { status: 409 })
  }

  const deliveredAt = order.events[0]?.createdAt
  const windowDays = Number(process.env.RETURN_WINDOW_DAYS ?? 7)
  if (!deliveredAt || Date.now() - deliveredAt.getTime() > windowDays * 86400_000) {
    return NextResponse.json({ error: `Returns are accepted within ${windowDays} days of delivery` }, { status: 409 })
  }

  await prisma.order.update({
    where: { id },
    data: {
      status: 'RETURN_REQUESTED',
      events: { create: { status: 'RETURN_REQUESTED', note: `Customer requested return: ${parsed.data.reason}` } },
    },
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: `ReturnRequestButton.tsx`** — client component `{ orderId, eligibleUntil }`: button "Request Return (until {date})" → inline reason textarea → POST → `router.refresh()`; error line on 4xx. Order page computes eligibility server-side (status ∈ {DELIVERED, DEPOSIT_REFUNDED} and last DELIVERED event within window) and renders the button + passes the deadline.

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit && npx eslint app components lib`

```bash
git add -A && git commit -m "feat(orders): customer return requests within window"
```

---

### Task 8: Order notes (WhatsApp context)

**Goal:** Admin notes on any order; internal by default; customer-visible notes interleave into the timeline and track-order.

**Files:**
- Create: `app/api/admin/orders/[id]/notes/route.ts`, `app/api/admin/orders/[id]/notes/[noteId]/route.ts`, `app/(admin)/admin/orders/[id]/OrderNotes.tsx`
- Modify: `app/(admin)/admin/orders/[id]/page.tsx`, `app/account/orders/[id]/page.tsx`, `app/api/track-order/route.ts`, `components/commerce/OrderTimeline.tsx`

**Acceptance Criteria:**
- [ ] POST note `{ body, internal? }` (author = admin session email); PATCH toggles `internal`; both admin-gated
- [ ] customer order page + track-order include ONLY `internal: false` notes, merged chronologically with events
- [ ] admin panel lists all notes with author/date/visibility toggle + add form

**Verify:** Task 9 scenarios; interim tsc/eslint

**Steps:**

- [ ] **Step 1: Notes routes.**

```typescript
// app/api/admin/orders/[id]/notes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const schema = z.object({ body: z.string().trim().min(1).max(2000), internal: z.boolean().optional() })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  const { id } = await params
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Note body required' }, { status: 400 })

  const order = await prisma.order.findUnique({ where: { id }, select: { id: true } })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const note = await prisma.orderNote.create({
    data: { orderId: id, author: session.user.email!, body: parsed.data.body, internal: parsed.data.internal ?? true },
  })
  return NextResponse.json(note, { status: 201 })
}
```

```typescript
// app/api/admin/orders/[id]/notes/[noteId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; noteId: string }> }) {
  await requireAdmin()
  const { id, noteId } = await params
  const parsed = z.object({ internal: z.boolean() }).safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'internal boolean required' }, { status: 400 })

  const note = await prisma.orderNote.findUnique({ where: { id: noteId } })
  if (!note || note.orderId !== id) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

  const updated = await prisma.orderNote.update({ where: { id: noteId }, data: { internal: parsed.data.internal } })
  return NextResponse.json(updated)
}
```

- [ ] **Step 2: `OrderNotes.tsx`** (client): props `{ orderId, notes }`; textarea + "internal" checkbox (default on) + Add; list rows `author · date · body` with a visibility toggle button calling PATCH then `router.refresh()`. Mount as a card on the admin detail page (`include: { notes: { orderBy: { createdAt: 'desc' } } }`).

- [ ] **Step 3: Customer surfaces.** `OrderTimeline` gains optional prop `notes?: { body: string; createdAt: Date }[]` — in the event-log branch merge notes into the rendered list sorted by `createdAt` (render as "Note — {body}"); for the happy-path branch render notes under a small "Updates" list after the steps. Order page passes `order.notes.filter(n => !n.internal)`; track-order response gains `notes: order.notes.filter(...)` (add `notes: true` to its include) and the track page passes them through.

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit && npx eslint app components lib`

```bash
git add -A && git commit -m "feat(orders): admin order notes with per-note customer visibility"
```

---

### Task 9: Lifecycle test suite v2 + docs + full verification

**Goal:** Every §8 spec scenario automated; docs reflect v2; full battery green.

**Files:**
- Modify: `scripts/_order-lifecycle-test.mjs`, `docs/API.md`, `docs/FEATURES.md`, `docs/LAUNCH.md`, memory via commit message only

**Acceptance Criteria:**
- [ ] scenarios: delivery-fail→retry→deliver; fail→RTO→RTO_RECEIVED→re-dispatch(new shipment row)→deliver; RTO_RECEIVED→cancel→partial refund mark (offline) → REFUNDED with ledger row; return request (window ok) → approve → received → offline refund mark → REFUNDED; return reject reverts to exact prior status; QC-fail → PREPARING requires reason (400 without); auto-split 3-item manual order → 3 children, sums exact, parent SPLIT_INTO_DELIVERIES, single-item no parent; notes internal/customer-visible on track-order; reason-required transitions 400 without note
- [ ] `docs/API.md`: retry-payment, return-request, sweep, notes endpoints + refund body change; `docs/LAUNCH.md` env table + cron section gain `ORDER_SWEEP_SECRET`, `ORDER_EXPIRY_HOURS`, `RETURN_WINDOW_DAYS` + sweep workflow item; `docs/FEATURES.md` rows for failed delivery/RTO, returns, retry/expiry, notes, auto-split
- [ ] Full battery green: `npx tsc --noEmit && npx eslint app components lib && npm run build && node scripts/_order-lifecycle-test.mjs && node scripts/_flow-test.mjs && node scripts/_crawl.mjs`

**Verify:** the battery above, all green

**Steps:**

- [ ] **Step 1: Extend the lifecycle script** with the scenarios listed in the acceptance criteria, following the existing `step()` + `api()` helpers. Multi-item split scenario skeleton:

```javascript
// ── auto-split (manual multi-item order) ──
{
  const variants = await prisma.productVariant.findMany({ take: 3, include: { product: true } });
  const res = await api('/api/admin/orders', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId, contactName: 'Split Buyer', contactPhone: '9876543210',
      addressLine1: '9 Residency Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001',
      applyDeposit: true, initialStatus: 'PAYMENT_CONFIRMED', paymentNote: 'UPI ref SPLIT1',
      items: variants.map((v, i) => ({ variantId: v.id, quantity: 1, unitPrice: 10000 * (i + 1) })),
    }),
  });
  step('multi-item manual order created', res.status === 201 && res.body.childOrderIds?.length === 3, JSON.stringify(res.body));
  const parent = await prisma.order.findUnique({ where: { id: res.body.orderId }, include: { children: true } });
  const sum = (f) => parent.children.reduce((s, c) => s + Number(c[f]), 0);
  step('parent SPLIT + proration exact',
    parent.status === 'SPLIT_INTO_DELIVERIES' &&
    sum('totalAmount') === Number(parent.totalAmount) &&
    sum('depositAmount') === Number(parent.depositAmount) &&
    sum('grandTotal') === Number(parent.grandTotal));
  // drive ONE child through fail→RTO→re-dispatch→deliver→return
  const child = parent.children[0].id;
  const patch = (status, extra = {}) => api(`/api/admin/orders/${child}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, ...extra }) });
  await patch('PREPARING');
  await patch('SHIPPED', { courierName: 'DTDC', awbCode: 'SPLIT-AWB-1' });
  let r = await patch('DELIVERY_FAILED');
  step('delivery-fail without reason rejected', r.status === 400);
  r = await patch('DELIVERY_FAILED', { note: 'Customer unavailable' });
  step('delivery-fail with reason ok', r.status === 200);
  await patch('OUT_FOR_DELIVERY'); // retry attempt
  await patch('DELIVERY_FAILED', { note: 'Wrong address' });
  await patch('RETURNING_TO_ORIGIN');
  await patch('RTO_RECEIVED');
  r = await patch('PREPARING', { note: 'Address corrected on WhatsApp' }); // re-dispatch
  step('RTO re-dispatch to PREPARING', r.status === 200);
  await patch('SHIPPED', { courierName: 'BlueDart', awbCode: 'SPLIT-AWB-2' });
  const ships = await prisma.shipment.count({ where: { orderId: child } });
  step('re-dispatch created second shipment row', ships === 2);
  await patch('DELIVERED');
  // customer return: request → approve → received → offline refund
  const ret = await api(`/api/orders/${child}/return-request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Size does not fit' }) });
  step('customer return request accepted', ret.status === 200);
  await patch('RETURN_IN_TRANSIT');
  await patch('RETURN_RECEIVED');
  const refund = await api(`/api/admin/orders/${child}/refund`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'partial', amount: 5000, reason: 'Return accepted minus making charges' }) });
  const childAfter = await prisma.order.findUnique({ where: { id: child }, include: { refunds: true } });
  step('return refund via ledger (offline partial)', refund.status === 200 && childAfter.status === 'REFUNDED' && childAfter.refunds.length === 1);
  // notes visibility
  await api(`/api/admin/orders/${child}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: 'internal: negotiated on WhatsApp', internal: true }) });
  await api(`/api/admin/orders/${child}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: 'Pickup scheduled for Saturday', internal: false }) });
  const track = await api('/api/track-order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: child, email: EMAIL }) });
  const bodies = JSON.stringify(track.body);
  step('track-order shows customer note, hides internal', bodies.includes('Pickup scheduled') && !bodies.includes('negotiated on WhatsApp'));
  // cleanup parent + children
  for (const c of [...parent.children.map((x) => x.id), parent.id]) {
    await prisma.orderNote.deleteMany({ where: { orderId: c } });
    await prisma.orderRefund.deleteMany({ where: { orderId: c } });
    await prisma.orderEvent.deleteMany({ where: { orderId: c } });
    await prisma.shipment.deleteMany({ where: { orderId: c } });
    await prisma.orderItem.deleteMany({ where: { orderId: c } });
  }
  await prisma.order.deleteMany({ where: { parentOrderId: parent.id } });
  await prisma.order.delete({ where: { id: parent.id } });
}
```

Also add: FAILED_OTHER — mark an active order FAILED_OTHER without note → 400; with note → 200; then offline refund mark → REFUNDED with ledger row. Also add: single-item manual order asserts `childOrderIds` absent/empty and no parent created; return-request outside window (seed DELIVERED event 10 days old) → 409; return reject revert mismatch → 409, correct revert → 200.

- [ ] **Step 2: Docs.** `docs/API.md`: add the four new endpoints (auth levels 👤/🔐/🤖), update refund body, note parent/child track-order response. `docs/LAUNCH.md` env table: `ORDER_SWEEP_SECRET` (random secret, sweep auth), `ORDER_EXPIRY_HOURS` (optional, default 24), `RETURN_WINDOW_DAYS` (optional, default 7); §2 cron list gains "order expiry sweep — hourly POST /api/admin/sweep-orders". `docs/FEATURES.md`: mark failed-delivery/RTO, customer returns, payment retry + expiry, order notes, auto-split as ✅.

- [ ] **Step 3: Full battery + commit**

Run: `npx tsc --noEmit && npx eslint app components lib && npm run build && node scripts/_order-lifecycle-test.mjs && node scripts/_flow-test.mjs && node scripts/_crawl.mjs`
Expected: all clean/green.

```bash
git add -A && git commit -m "feat(orders): lifecycle v2 complete — tests + docs"
```
