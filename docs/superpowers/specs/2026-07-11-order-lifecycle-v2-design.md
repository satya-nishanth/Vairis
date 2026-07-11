# Order Lifecycle v2 — Failures, Returns, Retries, Auto-Split

Extends the shipped order flow (docs/superpowers/plans/2026-07-10-razorpay-order-flow.md)
to cover reality: failed deliveries, RTO, wrong addresses, payment retries, customer
returns, per-order refund discretion, WhatsApp notes, and multi-item orders that always
deliver separately. "Better than Amazon" for a 105%/5% deposit jewellery store.

Decisions locked with Nishi:
- **Refund amounts are configurable per order** — admin enters amount (prefilled) +
  mandatory reason; deals are negotiated on WhatsApp, the system records rather than dictates.
- **Customer-initiated returns in scope** (site advertises "Easy Returns").
- **Payment retry on the same order** + 24h auto-expiry of unpaid orders.
- **Multi-item orders AUTO-SPLIT into child orders at confirmation** — jewellery pieces are
  crafted on independent schedules and never deliver together; splitting is a deterministic
  rule, not an admin decision. One child per line item. Single-item orders (the
  overwhelming majority) get no parent/children at all.
- **Self-explanatory status names** — `PAYMENT_PENDING` not `PENDING`, etc. (renames below).

---

## 1. State machine (single flat enum)

### Status set (18)

Renames of existing values via `ALTER TYPE "OrderStatus" RENAME VALUE` (safe, atomic):
`PENDING → PAYMENT_PENDING` · `PROCESSING → PREPARING`.
New values: `PAYMENT_EXPIRED`, `OUT_FOR_DELIVERY`, `DELIVERY_FAILED`,
`RETURNING_TO_ORIGIN`, `RTO_RECEIVED`, `RETURN_REQUESTED`, `RETURN_IN_TRANSIT`,
`RETURN_RECEIVED`, `SPLIT_INTO_DELIVERIES`, `FAILED_OTHER`.

Full set:
`PAYMENT_PENDING · PAYMENT_EXPIRED · PAYMENT_CONFIRMED · PREPARING · SHIPPED ·
OUT_FOR_DELIVERY · DELIVERY_FAILED · RETURNING_TO_ORIGIN · RTO_RECEIVED · DELIVERED ·
DEPOSIT_REFUNDED · RETURN_REQUESTED · RETURN_IN_TRANSIT · RETURN_RECEIVED · CANCELLED ·
REFUNDED · SPLIT_INTO_DELIVERIES · FAILED_OTHER`

**Two return families — never intersect:**
- *Courier bounce* (customer never received): `DELIVERY_FAILED → RETURNING_TO_ORIGIN →
  RTO_RECEIVED` — prefix `RTO`/`RETURNING`.
- *Customer return* (received, sends back): `RETURN_REQUESTED → RETURN_IN_TRANSIT →
  RETURN_RECEIVED` — prefix `RETURN_`.

Customer-facing labels live in `ORDER_STATUS_META` and stay warm ("Being Crafted",
"On its way") — the enum is for code/admin precision.

### Transitions

Legend: ⚡ webhook/system · 🔧 admin · ⏱ scheduled sweep · 👤 customer

| From | To | Trigger | Notes |
|------|----|---------|-------|
| PAYMENT_PENDING | PAYMENT_CONFIRMED | ⚡ capture (webhook/verify) | multi-item orders immediately auto-split (§5) |
| PAYMENT_PENDING | PAYMENT_EXPIRED | ⏱ sweep at 24h unpaid | sweep skips orders whose payment is CAPTURED (race-safe) |
| PAYMENT_PENDING | CANCELLED | 🔧 | deal fell through |
| PAYMENT_CONFIRMED | SPLIT_INTO_DELIVERIES | ⚡ auto (items > 1) | system, atomic with confirmation |
| PAYMENT_CONFIRMED | PREPARING / CANCELLED | 🔧 | |
| PREPARING | SHIPPED / CANCELLED | 🔧 | SHIPPED creates a new Shipment row |
| SHIPPED | OUT_FOR_DELIVERY | 🔧 | optional hop — manual updates are coarse |
| SHIPPED / OUT_FOR_DELIVERY | DELIVERED | 🔧 | |
| SHIPPED / OUT_FOR_DELIVERY | DELIVERY_FAILED | 🔧 | shipment.attempts++ · reason required |
| DELIVERY_FAILED | OUT_FOR_DELIVERY | 🔧 retry attempt | no hard cap; attempts logged per shipment |
| DELIVERY_FAILED | RETURNING_TO_ORIGIN | 🔧 | courier RTO / address unfixable |
| RETURNING_TO_ORIGIN | RTO_RECEIVED | 🔧 package back at origin | |
| RTO_RECEIVED | PREPARING | 🔧 re-dispatch | address corrected; next SHIPPED = NEW shipment row |
| RTO_RECEIVED | CANCELLED | 🔧 fail the order | refund follows (configurable) |
| DELIVERED | DEPOSIT_REFUNDED | ⚡ refund.processed (gateway) / 🔧 mark (offline) | |
| DELIVERED / DEPOSIT_REFUNDED | RETURN_REQUESTED | 👤 within window / 🔧 | `RETURN_WINDOW_DAYS` (default 7), checked at request |
| RETURN_REQUESTED | RETURN_IN_TRANSIT | 🔧 approve + pickup arranged | reject = revert to previous status with note |
| RETURN_IN_TRANSIT | RETURN_RECEIVED | 🔧 item back | |
| RETURN_RECEIVED | REFUNDED | 🔧 QC pass → refund (configurable) | prefill = remaining captured |
| RETURN_RECEIVED | PREPARING | 🔧 QC fail → re-dispatch to customer | mandatory reason note |
| CANCELLED | REFUNDED | ⚡ refund.processed / 🔧 offline mark | |
| *any active state* | FAILED_OTHER | 🔧 catch-all failure | mandatory reason note; for situations the graph doesn't cover (lost package, fraud, damage in QC, force majeure) |
| FAILED_OTHER | REFUNDED | ⚡ refund.processed / 🔧 offline mark | configurable amount via ledger |

**Late-payment race:** ⚡ capture on PAYMENT_EXPIRED/CANCELLED **never confirms** — records
the capture, auto-initiates a full gateway refund, writes an admin-alert event
("payment received after expiry — auto-refunded").

Offline orders (no gateway payment) use the same graph; money transitions are admin marks
(existing OFFLINE_SETTLEMENT pattern); every refund goes through the ledger (§3).

Customer timeline: happy path renders as steps; any order touching a failure/return state
renders the event-log view (existing pattern for CANCELLED/REFUNDED).

## 2. Shipments: one row per dispatch

`Shipment` loses `orderId @unique` → `Order 1-N Shipment`. Add: `attempts Int @default(0)`,
`outcome` (`DELIVERED | FAILED | RTO | null`), `dispatchedAt`. Re-dispatch after
RTO_RECEIVED and QC-fail re-ship each create a fresh row — full courier history per order.
Customer page shows latest shipment; admin sees all.

## 3. Refund ledger — `OrderRefund`

```prisma
model OrderRefund {
  id              String       @id @default(cuid())
  orderId         String       // child order when split — the audit anchor
  order           Order        @relation(...)
  amount          Decimal
  kind            RefundKind   // DEPOSIT | FULL | PARTIAL
  method          RefundMethod // GATEWAY | OFFLINE
  gatewayRefundId String?      @unique
  reason          String       // mandatory, admin-entered
  status          RefundStatus // INITIATED | COMPLETED (offline rows start COMPLETED)
  createdAt       DateTime     @default(now())
}
```

- Every refund initiation (gateway or offline mark) creates a row **with declared intent**.
- `refund.processed` webhook matches by `gatewayRefundId` and applies that row's intent —
  **no amount-inference** (configurable partial amounts made inference unsafe).
- Uniform "refunded so far" for gateway AND offline orders; `Payment.refundedAmount`
  remains for gateway reconciliation only.
- Refund API: `{ kind: deposit|full|partial, amount?, reason }` — amount prefilled by kind
  (deposit → depositAmount; full → remaining captured), editable, capped at remaining.

## 4. Payment retry + expiry

- Customer order page shows **Retry Payment** while PAYMENT_PENDING: reuses the existing
  `razorpayOrderId` (Razorpay orders accept multiple attempts; price stays locked).
- `POST /api/admin/sweep-orders` (Bearer `ORDER_SWEEP_SECRET`, GitHub Actions hourly):
  moves PAYMENT_PENDING orders older than `ORDER_EXPIRY_HOURS` (default 24) to
  PAYMENT_EXPIRED, skipping any whose payment is CAPTURED. Writes event.

## 5. Auto-split + payment anchoring (multi-item orders)

Rule: any confirmed order with ≥2 line items splits automatically — one child per line item.

**Payment anchoring — the invariant that makes money un-losable:**
the Payment row has exactly ONE permanent home, the parent order. Never moved, copied,
or re-attached.

```
PARENT VAR-123 (SPLIT_INTO_DELIVERIES — terminal container, never deleted)
 ├─ Payment: razorpayOrderId / razorpayPaymentId / ₹31,500 captured (105%)
 ├─ original item snapshot (single receipt for the customer)
 ├─ CHILD VAR-123-A (ring)     goods ₹18,000 · deposit ₹900 · parentOrderId → VAR-123
 └─ CHILD VAR-123-B (necklace) goods ₹12,000 · deposit ₹600 · parentOrderId → VAR-123
```

- **Online**: whole cart = ONE checkout, one payment. Retry/expiry act on the parent while
  PAYMENT_PENDING. On capture: children created atomically (same transaction as
  confirmation), parent → SPLIT_INTO_DELIVERIES.
- **Manual/WhatsApp**: same rule at creation (paid multi-item manual order is created
  directly as parent+children; offline parents have no Payment row, as today).
- **Children have no Payment row by design.** Any money action on a child resolves the
  gateway payment by walking `child.parentOrderId → parent.payment.razorpayPaymentId` and
  issues a **partial refund on the parent's payment**; the ledger row (§3) stores the
  child's orderId + gateway refund id — full audit chain Razorpay dashboard ↔ ledger ↔
  child ↔ parent, traversable from any end.
- **Proration**: child goods = its line snapshot price × qty; child deposit = parent
  deposit × (child goods / parent goods), rounded; last child absorbs remainders so
  Σ children == parent exactly (goods, deposit, grandTotal).
- **Invariants enforced at split + refund time**: Σ children.grandTotal = parent.grandTotal;
  Σ ledger refunds ≤ parent captured.
- Children start at PAYMENT_CONFIRMED and run the full lifecycle independently — own
  shipments, failures, returns, own deposit-share refund after own delivery. Two pieces
  ready together → admin ships both children with the same AWB; no special case.
- Admin UI: child page links "Payment via parent VAR-123 (₹31,500 captured)"; parent page
  shows the split map + rolled-up money summary (captured / refunded per child / remaining).
- Customer UX: parent renders "Order VAR-123 — N deliveries", each child's timeline inline
  (Amazon "Package 1 of 2" feel); children also listed in My Orders; /track-order accepts
  parent or child ids.
- One level only (children never split again). Splitting is one-way; events record the
  item assignment.

## 6. Notes — `OrderNote`

```prisma
model OrderNote { id, orderId, author (admin email), body, internal Boolean @default(true), createdAt }
```
- Admin adds notes at any point (WhatsApp context: "customer prefers evening delivery",
  "negotiated ₹500 off next purchase").
- `internal: true` (default) → admin-only. `internal: false` → appears on the customer
  timeline and track-order.
- Admin order page: notes panel with per-note visibility toggle; timeline interleaves
  events + customer-visible notes chronologically.

## 7. API surface (delta)

| Endpoint | Change |
|----------|--------|
| `PATCH /api/admin/orders/[id]` | all new transitions per §1; DELIVERY_FAILED and RETURN_RECEIVED→PREPARING require reason |
| `POST /api/admin/orders/[id]/refund` | `{ kind, amount?, reason }`; creates ledger row; child orders draw on parent payment; offline → COMPLETED mark + transition |
| `POST /api/admin/orders/[id]/notes` / `PATCH …/notes/[noteId]` | add note / toggle visibility |
| `POST /api/orders/[id]/retry-payment` 👤 | returns existing clientParams for own PAYMENT_PENDING order |
| `POST /api/orders/[id]/return-request` 👤 | within window, DELIVERED/DEPOSIT_REFUNDED only |
| `POST /api/admin/sweep-orders` 🤖 | expiry sweep (cron, `ORDER_SWEEP_SECRET`) |
| `POST /api/webhooks/payment` | ledger-matched refunds; late-capture auto-refund; auto-split on multi-item capture |
| `GET /api/orders`, order pages, track-order | parent/children rendering |

## 8. Testing (extend `scripts/_order-lifecycle-test.mjs`)

- delivery-fail → retry → deliver; delivery-fail → RTO → RTO_RECEIVED → re-dispatch → deliver
- RTO_RECEIVED → cancel → configurable partial refund (ledger row, correct status)
- customer return: request (window enforced) → approve → received → QC-pass refund;
  QC-fail re-dispatch (reason required)
- payment retry returns same gateway order id; sweep expires stale PAYMENT_PENDING and
  skips captured; late capture on PAYMENT_EXPIRED → auto-refund + alert event
- auto-split: 3-item checkout → capture → 3 children; proration sums exact; independent
  journeys; child deposit refund via parent payment (simulated webhook, ledger-matched);
  single-item order produces no parent; invariants hold
- offline versions: multi-item manual order auto-split; RTO refund mark; return refund mark
- notes: internal invisible on track-order; customer-visible interleaved

## 9. Out of scope

- Partial-quantity returns (return 1 of qty 2) — returns are per child order; auto-split
  already separates distinct pieces
- Automatic courier webhooks (waits for the delivery partner adapter)
- Exchange flows (return + new discounted order = two orders + notes)
- Customer-facing pickup scheduling (admin coordinates via WhatsApp)
