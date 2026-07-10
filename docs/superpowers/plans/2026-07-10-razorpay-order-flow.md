# Razorpay Order Flow — Phases 1–4

Goal: complete purchase lifecycle — checkout → payment → order journey → delivery → 5% deposit refund. Jewellery pricing model: customer pays **105%** of order total at checkout; **5% security deposit is refunded after delivery**.

Delivery partner undecided → shipping updates are **manual admin entries** behind a provider interface (`lib/shipping.ts`); Shiprocket slots in later without touching order code.

Razorpay account exists. Code reads `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID` from env; every payment surface degrades cleanly ("Payments not configured") until keys are added.

---

## Phase 1 — Order domain + checkout foundation

**Schema (prisma + hand-written migration, local `migrate deploy`):**
- `OrderStatus` + `DEPOSIT_REFUNDED` (after 5% refund lands post-delivery)
- `PaymentStatus` + `PARTIALLY_REFUNDED`
- `Order`: add `depositAmount Decimal`, `grandTotal Decimal` (= totalAmount + deposit), `contactName`, `contactPhone`
- `Payment`: add `razorpayRefundId String?`, `refundedAmount Decimal @default(0)`
- New `OrderEvent { id, orderId, status, note?, createdAt }` — powers the status timeline

**Money rules (server-side only, never trust client):**
- `totalAmount` = Σ line unitPrice (from `lib/pricing.ts` at checkout time) × qty
- `grandTotal` = round(totalAmount × 1.05); `depositAmount` = grandTotal − totalAmount
- OrderItem stores unit price snapshot

**API:** `POST /api/checkout` — auth required; validates address (zod); recomputes cart; creates Order(PENDING) + items + OrderEvent + Razorpay order (amount = grandTotal in paise) + Payment(CREATED); returns `{ orderId, razorpayOrderId, amountPaise, keyId, contact }`.

**UI:** rewrite mock `/checkout` — address form + live cart summary with 105%/deposit breakdown + "Pay ₹X" launching Razorpay Checkout JS.

Acceptance: checkout page renders real cart; order rows created; without env keys the API 503s and UI shows a clear notice.

## Phase 2 — Payment capture + webhook

- `lib/razorpay.ts`: REST via fetch + Basic auth (no SDK dep) — `createOrder`, `createRefund`, `verifyPaymentSignature` (HMAC-SHA256 of `order_id|payment_id`), `verifyWebhookSignature` (HMAC of raw body)
- `POST /api/payment/verify`: browser handler result → verify signature → Payment CAPTURED, Order PAYMENT_CONFIRMED (+event), clear user cart
- `POST /api/webhooks/razorpay`: raw-body signature check; idempotent handlers: `payment.captured` (same transition as verify), `payment.failed` (Payment FAILED +event), `refund.processed` (set refund fields; deposit refund → DEPOSIT_REFUNDED, full → REFUNDED)
- `/order-confirmation?orderId=` → real order summary (items, paid 105%, deposit note, timeline start)
- Best-effort order confirmation email via Resend (try/catch, never blocks flow)

Acceptance: simulated webhook with computed HMAC transitions order correctly + idempotently; verify endpoint rejects bad signatures.

## Phase 3 — Customer order journey + tracking

- `/account/orders` — list with status chips
- `/account/orders/[id]` — items, price breakdown (total / +5% deposit / paid / deposit refund state), status timeline from OrderEvents, shipment block (courier, AWB, tracking URL)
- `/track-order` — public lookup: order id + email → minimal status timeline (no auth; footer already links here)
- APIs: `GET /api/orders` (own), `GET /api/orders/[id]` (own), `POST /api/track-order`

Acceptance: full journey visible to customer; deposit explainer copy present at checkout, confirmation, and order detail.

## Phase 4 — Admin orders + refunds

- `/admin/orders` list (status filter) + `/admin/orders/[id]` detail
- Status transitions with validation (PAYMENT_CONFIRMED → PROCESSING → SHIPPED → DELIVERED); SHIPPED requires courier + AWB (manual until partner chosen); every transition writes OrderEvent
- Refunds via Razorpay refund API:
  - DELIVERED → "Refund 5% deposit" (partial refund of depositAmount)
  - pre-shipment CANCELLED → full refund
  - refund completion confirmed by `refund.processed` webhook
- APIs: `GET/PATCH /api/admin/orders[...]`, `POST /api/admin/orders/[id]/refund { type: deposit|full }`

Acceptance: admin can drive an order end-to-end incl. deposit refund; invalid transitions rejected; all writes admin-gated.

---

**Needed from Nishi (not blocking implementation):**
1. Razorpay test keys → `.env.local` (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_WEBHOOK_SECRET`)
2. Webhook URL registration in Razorpay dashboard (`https://<domain>/api/webhooks/razorpay`, events: payment.captured, payment.failed, refund.processed)
3. Production DB migration run (same constraint as NECKLACES migration)
4. Delivery partner decision → implement Shiprocket provider behind `lib/shipping.ts`
