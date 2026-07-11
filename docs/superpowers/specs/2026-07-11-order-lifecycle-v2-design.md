# Order Lifecycle v2 — Failures, Returns, Retries, Splits

Extends the shipped order flow (docs/superpowers/plans/2026-07-10-razorpay-order-flow.md)
to cover the messy reality: failed deliveries, RTO, wrong addresses, payment retries,
customer returns, per-order refund discretion, WhatsApp notes, and multi-item orders
delivering separately. "Better than Amazon" for a 105%/5% deposit jewellery store.

Decisions locked with Nishi:
- **Refund amounts are configurable per order** — admin enters amount (prefilled) + mandatory
  reason; deals are negotiated on WhatsApp, the system records rather than dictates.
- **Customer-initiated returns in scope** (site advertises "Easy Returns").
- **Payment retry on the same order** + 24h auto-expiry of unpaid orders.
- **Multi-delivery = split into child orders** (model C) — each child runs the full
  lifecycle independently; customer sees Amazon-style "Delivery 1 / Delivery 2".

---

## 1. State machine (single flat enum — approach A)

New `OrderStatus` values (Postgres enum additions, one-way):
`OUT_FOR_DELIVERY`, `DELIVERY_FAILED`, `RETURNING_TO_ORIGIN`, `RETURNED`,
`RETURN_REQUESTED`, `RETURN_IN_TRANSIT`, `RETURN_RECEIVED`, `EXPIRED`, `SPLIT`.

Full set (17):
PENDING · EXPIRED · PAYMENT_CONFIRMED · PROCESSING · SHIPPED · OUT_FOR_DELIVERY ·
DELIVERY_FAILED · RETURNING_TO_ORIGIN · RETURNED · DELIVERED · DEPOSIT_REFUNDED ·
RETURN_REQUESTED · RETURN_IN_TRANSIT · RETURN_RECEIVED · CANCELLED · REFUNDED · SPLIT

### Transitions

Legend: ⚡ webhook/system · 🔧 admin · ⏱ scheduled sweep · 👤 customer

| From | To | Trigger | Notes |
|------|----|---------|-------|
| PENDING | PAYMENT_CONFIRMED | ⚡ capture (webhook/verify) | unchanged |
| PENDING | EXPIRED | ⏱ sweep at 24h unpaid | sweep skips orders whose payment is CAPTURED (race-safe) |
| PENDING | CANCELLED | 🔧 | deal fell through |
| PAYMENT_CONFIRMED | PROCESSING / CANCELLED | 🔧 | unchanged |
| PROCESSING | SHIPPED / CANCELLED | 🔧 | SHIPPED creates a new Shipment row |
| PROCESSING | SPLIT | 🔧 split action | see §5; pre-dispatch only (also allowed from PAYMENT_CONFIRMED) |
| SHIPPED | OUT_FOR_DELIVERY | 🔧 | optional hop — manual updates are coarse |
| SHIPPED / OUT_FOR_DELIVERY | DELIVERED | 🔧 | |
| SHIPPED / OUT_FOR_DELIVERY | DELIVERY_FAILED | 🔧 | shipment.attempts++ with reason |
| DELIVERY_FAILED | OUT_FOR_DELIVERY | 🔧 retry attempt | no hard cap; attempts logged per shipment |
| DELIVERY_FAILED | RETURNING_TO_ORIGIN | 🔧 | courier RTO / address unfixable |
| RETURNING_TO_ORIGIN | RETURNED | 🔧 package received back | |
| RETURNED | PROCESSING | 🔧 re-dispatch | address corrected; next SHIPPED creates a NEW shipment |
| RETURNED | CANCELLED | 🔧 fail the order | refund follows (configurable) |
| DELIVERED | DEPOSIT_REFUNDED | ⚡ refund.processed (gateway) / 🔧 mark (offline) | unchanged |
| DELIVERED / DEPOSIT_REFUNDED | RETURN_REQUESTED | 👤 button within window / 🔧 | window: `RETURN_WINDOW_DAYS` (default 7), checked at request time |
| RETURN_REQUESTED | RETURN_IN_TRANSIT | 🔧 approve + pickup arranged | reject = revert to previous status with note |
| RETURN_IN_TRANSIT | RETURN_RECEIVED | 🔧 item back | |
| RETURN_RECEIVED | REFUNDED | 🔧 QC pass → refund (configurable) | prefill = remaining captured amount |
| RETURN_RECEIVED | PROCESSING | 🔧 QC fail → re-dispatch item to customer | mandatory reason note |
| CANCELLED | REFUNDED | ⚡ refund.processed / 🔧 offline mark | |

Late-payment race: ⚡ capture arriving on EXPIRED/CANCELLED **never confirms** — it records
the capture, auto-initiates a full gateway refund, and writes an admin-alert event
("payment received after expiry — auto-refunded").

Offline orders (no gateway payment) use the same graph; money transitions are admin marks
(existing OFFLINE_SETTLEMENT pattern) and every refund goes through the ledger (§3).

Customer timeline: happy-path steps render as today; any order touching a failure/return
state renders the event-log view (existing pattern for CANCELLED/REFUNDED).

## 2. Shipments: one row per dispatch

`Shipment` loses its `orderId @unique` → `Order 1-N Shipment`. Add:
`attempts Int @default(0)`, `outcome` (`DELIVERED | FAILED | RTO | null`), `dispatchedAt`.
Re-dispatch after RETURNED and QC-fail re-ship each create a fresh row — full courier
history per order. Customer order page shows the latest shipment; admin sees all.

## 3. Refund ledger — `OrderRefund`

```prisma
model OrderRefund {
  id               String   @id @default(cuid())
  orderId          String
  order            Order    @relation(...)
  amount           Decimal
  kind             RefundKind   // DEPOSIT | FULL | PARTIAL
  method           RefundMethod // GATEWAY | OFFLINE
  gatewayRefundId  String?  @unique
  reason           String       // mandatory, admin-entered
  status           RefundStatus // INITIATED | COMPLETED (offline rows start COMPLETED)
  createdAt        DateTime @default(now())
}
```

- Every refund initiation (gateway or offline mark) creates a row **with declared intent**.
- `refund.processed` webhook matches by `gatewayRefundId` and applies that row's intent —
  **no more amount-inference** (custom partial amounts made inference unsafe).
- Uniform "refunded so far" for gateway AND offline orders (fixes offline tracking gap);
  `Payment.refundedAmount` stays for gateway reconciliation only.
- Refund API becomes `{ kind, amount?, reason }`; amount prefilled by kind
  (deposit → depositAmount; full → remaining captured), editable, capped at remaining.
- For child orders (§5) gateway refunds draw on the **parent's** payment
  (`razorpayPaymentId`), ledger row attaches to the child.

## 4. Payment retry + expiry

- Order detail page (customer) shows **Retry Payment** while PENDING with a live gateway
  order: reuses the existing `razorpayOrderId` (Razorpay orders accept multiple attempts;
  price stays locked as created).
- `POST /api/admin/sweep-orders` (Bearer `ORDER_SWEEP_SECRET`, GitHub Actions
  hourly): expires PENDING orders older than `ORDER_EXPIRY_HOURS` (default 24), skipping
  any whose payment is CAPTURED. Writes EXPIRED event.

## 5. Order splitting (multi-item, separate deliveries)

Admin action on PAYMENT_CONFIRMED/PROCESSING orders with ≥2 items: **Split order**.

- Admin assigns items to 2+ groups → children created; parent → status `SPLIT` (terminal
  container), `Order.parentOrderId` self-relation.
- Money proration per child: goods = its items' snapshot prices; deposit = parent deposit
  × (child goods / parent goods), rounded, last child absorbs remainder so sums match
  exactly. grandTotal likewise.
- Children start at parent's status (PAYMENT_CONFIRMED/PROCESSING) and run the full
  lifecycle independently — own shipments, failures, returns, deposit refund after own
  delivery (partial refund against the parent payment via ledger).
- No payment rows on children; `paymentOrderId` resolution walks to parent.
- One level only (children cannot be split again — YAGNI; revisit if ever needed).
- Customer UX: parent renders as "Order VAR-… — split into N deliveries" with each child's
  timeline inline (Amazon "Package 1 of 2" feel); children also appear in My Orders.
- Splitting is one-way; the event log records item assignment per child.

## 6. Notes — `OrderNote`

```prisma
model OrderNote { id, orderId, author (admin email), body, internal Boolean @default(true), createdAt }
```
- Admin adds notes at any point (WhatsApp context: "customer prefers evening delivery",
  "negotiated ₹500 off next purchase").
- `internal: true` (default) → admin-only. `internal: false` → appears on the customer
  timeline and track-order.
- Admin order page: notes panel with visibility toggle per note; timeline interleaves
  events + customer-visible notes chronologically.

## 7. API surface (delta)

| Endpoint | Change |
|----------|--------|
| `PATCH /api/admin/orders/[id]` | accepts all new transitions per §1 map; DELIVERY_FAILED requires reason; RETURN_RECEIVED→PROCESSING requires reason |
| `POST /api/admin/orders/[id]/refund` | body `{ kind: deposit\|full\|partial, amount?, reason }`; creates ledger row; offline orders → COMPLETED mark + status transition |
| `POST /api/admin/orders/[id]/split` | `{ groups: [[itemId,…],[itemId,…]] }` → child ids |
| `POST /api/admin/orders/[id]/notes` / `PATCH …/notes/[noteId]` | add note / toggle visibility |
| `POST /api/orders/[id]/retry-payment` 👤 | returns existing clientParams for PENDING own order |
| `POST /api/orders/[id]/return-request` 👤 | within window, DELIVERED/DEPOSIT_REFUNDED only |
| `POST /api/admin/sweep-orders` 🤖 | expiry sweep (cron) |
| `POST /api/webhooks/payment` | ledger-matched refunds; late-capture auto-refund rule |

## 8. Testing

Extend `scripts/_order-lifecycle-test.mjs`:
- delivery-fail → retry → deliver; delivery-fail → RTO → returned → re-dispatch → deliver
- RTO → cancel → configurable partial refund (ledger row, correct status)
- customer return: request (window enforced) → approve → received → QC-pass refund;
  QC-fail re-dispatch
- payment retry returns same gateway order id; expiry sweep expires stale PENDING and
  skips captured; late capture on EXPIRED → auto-refund + alert event
- split: 3-item order → 2 children; proration sums exact; children independent journeys;
  child deposit refund via parent payment (simulated webhook, ledger-matched)
- offline order versions of: RTO refund mark, return refund mark
- notes: internal invisible on track-order; customer-visible interleaved

## 9. Out of scope

- Partial-quantity returns (return 1 of qty 2) — return is per order/child; splitting
  covers separable pieces
- Automatic courier webhooks (waits for delivery partner adapter)
- Exchange flows (return + new discounted order = two orders + notes)
- Customer-facing return pickup scheduling (admin coordinates via WhatsApp)
