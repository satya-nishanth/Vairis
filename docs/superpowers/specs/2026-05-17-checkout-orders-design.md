# Checkout & Orders Implementation Design

**Goal:** Build order management + WhatsApp enquiry flow with UPI payment confirmation — no payment gateway required, works in prod today without BIS cert.

**Architecture:** Two independent flows share the same Order/OrderItem infrastructure. Flow A (self-checkout via Razorpay modal) is built but gated behind BIS cert. Flow B (WhatsApp enquiry + manual UPI) is fully live immediately.

**Tech Stack:** Next.js 14 App Router, Prisma 5, Supabase PostgreSQL + Storage, Resend (email), Vercel (no crons — GitHub Actions for cleanup job)

---

## Two Flows

### Flow A — Self Checkout (web, post-BIS only)
```
Cart → Address → POST /api/checkout → Razorpay modal → webhook → PAYMENT_CONFIRMED
```
- UI shows "Coming soon" until BIS cert activated in prod
- Can test fully in Razorpay test mode (dev/staging)

### Flow B — WhatsApp Enquiry (live in prod now)
```
PDP/Cart → "Enquire on WhatsApp"
  → POST /api/orders/enquire  (creates Order: WHATSAPP_ENQUIRY, PENDING)
  → redirect wa.me/?text="Hi, interested in [product] — Ref #ORD-XYZ"

Admin panel → sees order → sets finalAmount
  → Order moves to AWAITING_PAYMENT
  → Resend email to customer: "Complete your payment"

Customer → My Orders page → sees UPI deep link + screenshot upload
  → pays vairis@upi with ref ORD-XYZ
  → uploads payment screenshot

Admin panel → sees screenshot → clicks "Confirm Payment"
  → Order moves to PAYMENT_CONFIRMED
  → Resend email: "Payment confirmed, preparing your order"

Admin → marks Shipped (adds tracking) → Delivered
  → Resend emails at each step
```

---

## Schema Changes

```prisma
enum OrderSource {
  CHECKOUT
  WHATSAPP_ENQUIRY
}

enum OrderStatus {
  PENDING             // enquiry created, awaiting admin action
  AWAITING_PAYMENT    // admin set price, UPI details sent to customer
  PAYMENT_REVIEW      // customer uploaded screenshot, pending admin verify
  PAYMENT_CONFIRMED   // admin confirmed (Phase 1) or webhook (Phase 2)
  PROCESSING          // being made / prepared
  SHIPPED
  DELIVERED
  CANCELLED
  REFUNDED
}

model Order {
  // existing fields unchanged ...
  source             OrderSource  @default(CHECKOUT)
  finalAmount        Decimal?     // admin sets this for WHATSAPP_ENQUIRY orders
  paymentScreenshotUrl String?    // Supabase Storage URL, customer uploads
  paymentLinkUrl     String?      // Phase 2: Razorpay payment link (nullable)
  paymentLinkId      String?      // Phase 2: Razorpay payment link ID (nullable)
  customerMobile     String?      // captured from WhatsApp enquiry form
}
```

`Payment` row only created for Flow A (Razorpay). Flow B uses `Order.status` + `Order.paymentScreenshotUrl` only.

---

## API Routes

### Customer-facing

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/orders/enquire` | Create WHATSAPP_ENQUIRY order from cart items or single variant |
| `GET` | `/api/orders` | Customer's order list |
| `GET` | `/api/orders/[id]` | Single order detail + payment info |
| `POST` | `/api/orders/[id]/screenshot` | Upload payment screenshot to Supabase Storage |
| `POST` | `/api/checkout` | Flow A: create Order + Razorpay order, return clientSecret |
| `POST` | `/api/webhooks/razorpay` | Flow A: verify signature, confirm payment |

### Admin-facing

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/admin/orders` | All orders, filterable by status/source |
| `PATCH` | `/api/admin/orders/[id]` | Set finalAmount, update status (Shipped/Delivered), add tracking |
| `POST` | `/api/admin/orders/[id]/confirm-payment` | Mark PAYMENT_CONFIRMED (Phase 1 manual) |

---

## Inventory (Stock Reservation)

- **Flow B:** Stock decremented when admin sets `finalAmount` (order moves to AWAITING_PAYMENT). Released if order cancelled.
- **Flow A:** Stock decremented on Order creation (checkout). Released if Razorpay payment fails/expires. Razorpay order has `expire_by = now + 9 min`.
- **Cleanup cron** (GitHub Actions, every 30 min): find Flow A orders in PENDING > 15 min → restore stock → mark CANCELLED.

---

## Price Locking

- Gold rate + calculated price snapshotted at enquiry/checkout time → stored in `OrderItem.price`
- `Order.totalAmount` = sum of item prices at snapshot time
- `Order.finalAmount` = admin-set price (for WHATSAPP_ENQUIRY, includes gemstone charges)
- Payment amount = `finalAmount ?? totalAmount`

---

## Customer "My Orders" — Status UI Copy

| Status | Shown to customer |
|--------|------------------|
| `PENDING` | "Received — our team will contact you shortly" |
| `AWAITING_PAYMENT` | Step-by-step UPI payment instructions (see below) |
| `PAYMENT_REVIEW` | "Screenshot received — verifying within 2 hours. We'll email you." |
| `PAYMENT_CONFIRMED` | "Payment confirmed — your order is being prepared" |
| `PROCESSING` | "Your jewellery is being prepared" |
| `SHIPPED` | "Shipped — [courier] [tracking link]" |
| `DELIVERED` | "Delivered" |
| `CANCELLED` | "Cancelled" |

### AWAITING_PAYMENT UI copy (exact)

```
Complete your payment in 3 steps:

① Pay ₹12,500 to  vairis@upi  (Vairis Fine Jewellery)
  Add ref in remarks: ORD-XYZ

  [Pay via UPI →]   ← upi://pay?pa=vairis@upi&pn=Vairis Fine Jewellery&am=12500&tn=ORD-XYZ

② Screenshot your payment confirmation from your UPI app

③ Upload it here — we'll verify and start your order
  [Upload Screenshot]

Usually verified within 2 business hours.
We'll email you the moment it's confirmed.
```

---

## Emails (Resend)

| Trigger | Subject | Content |
|---------|---------|---------|
| Order created (enquiry) | `We received your enquiry — #ORD-XYZ` | Product name, order ref, "team will contact you" |
| Admin sets finalAmount | `Action needed — complete your Vairis order #ORD-XYZ` | 3-step UPI instructions + link to order page |
| Screenshot uploaded | `Payment screenshot received — #ORD-XYZ` | "Verifying within 2 hours" |
| Admin confirms payment | `Payment confirmed — #ORD-XYZ` | "Your jewellery is being prepared" |
| Admin marks Shipped | `Your order has shipped — #ORD-XYZ` | Courier + tracking link |

All customer comms via email only. WhatsApp = initial enquiry channel only.

---

## Admin Panel — Orders UI

**Order list page** (`/admin/orders`):
- Table: order ref, customer name, product(s), total/final amount, status, date
- Filter by status + source (CHECKOUT / WHATSAPP_ENQUIRY)
- Each row → opens order detail

**Order detail page** (`/admin/orders/[id]`):
- Customer: name, email, mobile (if captured)
- Items: product name, variant, weight, calculated gold price
- `finalAmount` editable field (WHATSAPP_ENQUIRY only) — "Set final price"
- Payment screenshot (if uploaded) shown inline — "Confirm Payment" button
- Status controls: mark Processing → Shipped (tracking field) → Delivered
- WhatsApp quick-link: `wa.me/91MOBILE` (opens chat)

---

## Phase 2 — Post BIS (Flow A activation)

Changes needed:
- Add Razorpay SDK (`razorpay` npm package)
- `POST /api/checkout` creates Razorpay order, returns `razorpayOrderId`
- Frontend loads Razorpay JS, opens modal
- `POST /api/webhooks/razorpay` verifies HMAC signature → sets PAYMENT_CONFIRMED
- Swap "Coming soon" CTA on cart page to real checkout button
- Zero schema changes

Flow B stays as-is (UPI manual). Razorpay Payment Links for Flow B = not planned.

---

## Implementation Order

1. Schema migration (new fields + enum values)
2. `POST /api/orders/enquire` + stock decrement
3. Customer orders pages (`/account/orders`, `/account/orders/[id]`)
4. Screenshot upload (`POST /api/orders/[id]/screenshot`)
5. Admin orders list + detail pages
6. `POST /api/admin/orders/[id]/confirm-payment`
7. `PATCH /api/admin/orders/[id]` (finalAmount + status)
8. Resend email triggers (5 emails)
9. Cleanup cron (GitHub Actions)
10. Flow A: checkout API + Razorpay modal (test mode, gated in prod)
