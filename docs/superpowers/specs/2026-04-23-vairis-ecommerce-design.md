# Vairis Fine Jewellery — E-commerce Website Design

**Date:** 2026-04-23
**Sub-project:** 1 of 4 (Website → Admin Panel → Payments → WhatsApp Bot)
**Author:** Satya Nishanth (Nishi)
**Status:** Approved, ready for implementation plan

---

## 1. Scope

MVP e-commerce website for Vairis Fine Jewellery. Lean page set, full checkout capability (Razorpay in test mode until BIS certificate arrives), Google auth, delivery-only fulfillment via Shiprocket.

**In scope (this sub-project):**
- Customer-facing store (all core pages)
- Basic admin panel (product + order management, sufficient to run the store)
- WhatsApp bot API hooks (`/api/internal/*`) — bot itself implemented separately

**Out of scope:**
- Full admin panel with RBAC (separate sub-project, candidate owner: Fayaz)
- WhatsApp bot implementation
- Product reviews (planned, not MVP)
- Kotak payment gateway (evaluate at scale via A/B test)

---

## 2. Architecture

```
Browser
  └── Next.js 14 (App Router)
        ├── /app/(store)            customer-facing pages (SSR + ISR)
        ├── /app/(admin)            basic admin (server-side, auth-gated)
        └── /app/api/
              ├── razorpay/webhook  payment confirmation (source of truth)
              ├── courier/webhook   shipment status updates
              ├── whatsapp/webhook  WhatsApp bot handler (Next.js, Meta API)
              ├── cron/release-stock  stock timeout handler (cron-triggered)
              └── internal/         bot-callable endpoints (API key auth)
                    ├── products/
                    ├── stock/
                    └── orders/

Hosting
  MVP:    Vercel (zero config, Vercel Cron for stock release)
  Future: Azure Container Apps — Docker image, full ISR + API route support
          DO NOT use Azure Static Web Apps (incomplete Next.js support)

Supabase (MVP backend — designed to eject)
  ├── PostgreSQL via Prisma ORM     swap DATABASE_URL → done
  ├── Auth (Google OAuth)           swap to NextAuth.js (~4 hrs work)
  └── Storage (product images)      swap to Azure Blob (~2 hrs work)

External
  ├── Razorpay    payments + EMI
  ├── Shiprocket  courier booking + tracking
  └── Resend      transactional email (order confirmation)
```

### Migration safety rules (enforced throughout)
- All DB queries through Prisma — never Supabase SDK for data access
- No Supabase Edge Functions — all logic in Next.js API routes
- No Supabase Realtime in core flows
- No Row Level Security in app logic — security enforced in API routes
- WhatsApp bot calls `/api/internal/*` only, never touches Supabase directly

### WhatsApp bot
Built as Next.js API route (`/api/whatsapp/webhook`) using official Meta WhatsApp Business API (webhook-based, no persistent connection needed). No Python service. AI calls (smart replies, product queries) go to Azure OpenAI directly from Next.js.

---

## 3. Design Direction

- **Nav + hero:** Dark luxury (forest green `#0f2418`, gold `#c9a84c`) — consistent with current brand identity at thevairis.com
- **Product catalog + detail + checkout:** White/light background — product photography reads better, prices and variants clearer
- **Font:** Cormorant Garamond (already in use)

---

## 4. Data Model

Prisma schema. Works against Supabase PostgreSQL now; swap `DATABASE_URL` to migrate to Azure PostgreSQL.

```prisma
enum Category    { RINGS EARRINGS NECKLACES BRACELETS }
enum MetalType   { GOLD_18K GOLD_22K SILVER_925 ROSE_GOLD }
enum OrderStatus {
  PENDING PAYMENT_CONFIRMED PROCESSING SHIPPED DELIVERED CANCELLED REFUNDED
}
enum PaymentStatus { CREATED AUTHORIZED CAPTURED FAILED REFUNDED }

model User {
  id        String     @id @default(cuid())
  name      String
  email     String     @unique
  mobile    String?
  googleId  String?    @unique
  createdAt DateTime   @default(now())
  addresses Address[]
  orders    Order[]
  cartItems CartItem[]
}

model Address {
  id        String  @id @default(cuid())
  userId    String
  user      User    @relation(fields: [userId], references: [id])
  line1     String
  line2     String?
  city      String
  state     String
  pincode   String
  isDefault Boolean @default(false)
}

model Product {
  id          String           @id @default(cuid())
  name        String
  description String
  category    Category
  images      String[]         // Supabase Storage URLs
  basePrice   Decimal
  isActive    Boolean          @default(true)
  createdAt   DateTime         @default(now())
  variants    ProductVariant[]
}

model ProductVariant {
  id         String      @id @default(cuid())
  productId  String
  product    Product     @relation(fields: [productId], references: [id])
  metalType  MetalType
  size       String?     // null for earrings/necklaces
  price      Decimal
  stock      Int         @default(0)
  sku        String      @unique
  cartItems  CartItem[]
  orderItems OrderItem[]
}

model CartItem {
  id        String         @id @default(cuid())
  userId    String
  user      User           @relation(fields: [userId], references: [id])
  variantId String
  variant   ProductVariant @relation(fields: [variantId], references: [id])
  quantity  Int
  @@unique([userId, variantId])
}

model Order {
  id           String      @id @default(cuid())
  userId       String
  user         User        @relation(fields: [userId], references: [id])
  items        OrderItem[]
  status       OrderStatus @default(PENDING)
  totalAmount  Decimal
  // address snapshot — survives user editing their saved address later
  addressLine1 String
  addressLine2 String?
  city         String
  state        String
  pincode      String
  payment      Payment?
  shipment     Shipment?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
}

model OrderItem {
  id          String         @id @default(cuid())
  orderId     String
  order       Order          @relation(fields: [orderId], references: [id])
  variantId   String
  variant     ProductVariant @relation(fields: [variantId], references: [id])
  quantity    Int
  price       Decimal        // snapshot at purchase time
  productName String         // snapshot — product name could change
}

model Payment {
  id                String        @id @default(cuid())
  orderId           String        @unique
  order             Order         @relation(fields: [orderId], references: [id])
  razorpayOrderId   String        @unique
  razorpayPaymentId String?
  status            PaymentStatus @default(CREATED)
  amount            Decimal
  createdAt         DateTime      @default(now())
}

model Shipment {
  id           String   @id @default(cuid())
  orderId      String   @unique
  order        Order    @relation(fields: [orderId], references: [id])
  shiprocketId String?
  awbCode      String?  // courier tracking number
  courierName  String?
  trackingUrl  String?
  status       String?
  updatedAt    DateTime @updatedAt
}
```

---

## 5. Page Routes

```
app/
├── (store)/
│   ├── page.tsx                          Homepage
│   ├── shop/
│   │   ├── page.tsx                      All products (filterable by category)
│   │   ├── [category]/page.tsx           /shop/rings, /shop/earrings etc. (ISR)
│   │   └── product/[id]/page.tsx         Product detail (ISR, revalidate 60s)
│   ├── cart/page.tsx                     Cart (client-side)
│   ├── checkout/page.tsx                 Checkout (auth-gated)
│   ├── order/
│   │   ├── confirmation/[id]/page.tsx    Post-payment success
│   │   └── track/[id]/page.tsx           Order tracking
│   └── account/
│       ├── page.tsx                      Orders list
│       ├── orders/[id]/page.tsx          Order detail
│       └── profile/page.tsx             Name, mobile, addresses
│
├── (admin)/                              Separate layout, email whitelist auth
│   ├── dashboard/page.tsx
│   ├── products/
│   │   ├── page.tsx
│   │   ├── new/page.tsx
│   │   └── [id]/edit/page.tsx
│   └── orders/
│       ├── page.tsx
│       ├── [id]/page.tsx                Order detail + ship action
│       └── payment-link/page.tsx        Generate Razorpay payment link
│
├── auth/
│   ├── login/page.tsx
│   └── callback/page.tsx
│
└── api/
    ├── razorpay/webhook/route.ts
    ├── courier/webhook/route.ts
    ├── whatsapp/webhook/route.ts
    ├── cron/release-stock/route.ts      Stock timeout handler (every 5 min)
    └── internal/
        ├── products/route.ts
        ├── stock/route.ts
        └── orders/route.ts
```

**Rendering:**
- Catalog + product detail → ISR (revalidate 60s) — SEO + fresh stock
- Cart, checkout, account → client-side only
- Admin → server-side, never cached

---

## 6. Non-Functional Requirements

- **Mobile-first responsive** — all customer-facing pages optimised for mobile. Desktop supported.
- **SEO:** `sitemap.xml` auto-generated (Next.js), `robots.txt`, OpenGraph tags on all public pages. Product + catalog pages use ISR for crawlability.
- **Product images:** Up to 5 images per product, first image = primary (used in catalog grid). Stored in Supabase Storage, served via Next.js Image component (auto-optimised).
- **EMI display:** Razorpay Affordability Widget embedded on every product detail page — shows EMI breakdown (No-Cost EMI, standard EMI) without extra API calls.

---

## 7. Checkout + Payment Flow

1. User on `/checkout` (must be logged in — redirect to `/auth/login` if not)
2. Fills address, reviews cart, clicks "Place Order"
3. Server: atomic stock check — any variant with `stock = 0` blocks order, shows error
4. Server: create `Order` (status: `PENDING`), decrement `stock` per item, create Razorpay order
5. Client: Razorpay SDK modal opens (UPI / card / EMI)
6. **Payment failure:** Order stays `PENDING`, stock restored, user sees retry option
7. **Payment success:** Razorpay POSTs to `/api/razorpay/webhook`
8. Webhook handler: verify Razorpay signature → update Order to `PAYMENT_CONFIRMED` → clear cart → send confirmation email via Resend → book Shiprocket shipment
9. Redirect to `/order/confirmation/[id]`

**Stock reservation approach (Option 1 — revisit at scale):**
- Stock decremented when Order created (PENDING)
- Restored if payment fails or times out — 15-min timeout enforced via a cron endpoint (`/api/cron/release-stock`): finds PENDING orders older than 15 min, restores stock, marks order CANCELLED
  - **Vercel (MVP):** Vercel Cron triggers the endpoint every 5 min
  - **Azure (future):** Azure Functions timer trigger calls same endpoint every 5 min — no code change, just config
- No separate `reserved` field — add when concurrent checkout conflicts appear in logs

**Security:** Razorpay webhook is the only source of truth for payment. Client-side payment success callback is never trusted alone.

**Email notifications (via Resend):**
- Order confirmed (PAYMENT_CONFIRMED) — order summary + estimated delivery
- Order shipped (SHIPPED) — AWB code + courier tracking link
- Order delivered (DELIVERED) — delivery confirmation + care instructions

---

## 8. Order Cancellation + Refund Flow

**Cancellation window:** Customer can cancel only while order status is `PENDING`, `PAYMENT_CONFIRMED`, or `PROCESSING`. Cannot cancel once `SHIPPED` (courier has the package).

**Cancellation flow:**
1. Customer clicks "Cancel Order" on `/account/orders/[id]`
2. Server checks status — reject if `SHIPPED` or `DELIVERED`
3. Restore stock (`stock += quantity` for each OrderItem variant)
4. If payment was captured (status was `PAYMENT_CONFIRMED` or `PROCESSING`):
   - Call Razorpay refund API: `POST /v1/payments/{razorpayPaymentId}/refund`
   - Update `Payment.status` → `REFUNDED`
   - Send refund confirmation email (Resend): "Refund initiated, 5–7 business days"
5. Update `Order.status` → `CANCELLED`

**Refund approach:** Automated via Razorpay API — no manual dashboard intervention. Razorpay handles bank transfer (5–7 business days). Full refund only (no partial refunds in MVP).

---

## 9. Direct Payment Links

Admin can generate a Razorpay Payment Link for custom orders (e.g. negotiated bespoke pieces, WhatsApp sales).

**Flow:**
1. Admin goes to `/admin/orders/new-payment-link`
2. Enters customer name, mobile, amount, description
3. Server calls Razorpay Payment Links API: `POST /v1/payment_links`
4. Razorpay returns a short URL (e.g. `rzp.io/l/abc123`)
5. Admin copies link → shares via WhatsApp or email manually
6. Customer pays via link → Razorpay webhook fires → order created in DB automatically

**No separate order creation needed** — webhook handler detects payment link payments and auto-creates an Order record.

---

## 10. User Accounts

- Browse: guest (no login required)
- Order / track / cancel: requires account
- Auth: Supabase Auth with Google OAuth provider
- Data collected: name, email, mobile number
- Migration path: swap Supabase Auth → NextAuth.js with Google provider

---

## 11. Admin Panel (MVP scope)

Auth: email whitelist check via `ADMIN_EMAILS` env variable (comma-separated). No RBAC. Add roles when Fayaz takes ownership.

**Products:**
- Create / edit / deactivate product
- Upload images to Supabase Storage (up to 5 per product, first = primary)
- Manage variants + manual stock adjustment

**Orders:**
- View all orders + filter by status
- Update status manually (PROCESSING → SHIPPED etc.)
- Trigger Shiprocket booking
- View payment details
- Generate direct payment links (Razorpay Payment Links)

---

## 12. Internal API (WhatsApp Bot Endpoints)

All routes under `/api/internal/*`, protected by `X-API-Key` header.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/internal/products` | GET | Search/list products by category, name |
| `/api/internal/products/[id]` | GET | Product detail + variant stock |
| `/api/internal/stock` | GET | Check variant availability |
| `/api/internal/orders` | POST | Create order (bot-initiated) |
| `/api/internal/orders/[id]` | GET | Order status |

Bot never queries Supabase directly — always through this layer. DB migration transparent to bot.

---

## 13. Key Decisions Log

| Decision | Choice | Reason |
|---|---|---|
| Checkout approach | Full e-commerce, Razorpay test mode | BIS cert in progress; don't delay build |
| Payment gateway | Razorpay | Better adoption/reliability; evaluate Kotak at scale |
| Backend for MVP | Supabase (PostgreSQL + Auth + Storage) | Saves 3–4 weeks on auth + devops |
| Migration path | Prisma ORM + Next.js API routes only | Swap DATABASE_URL = done; Auth swap ~4 hrs |
| WhatsApp bot | Next.js + Meta WhatsApp Business API | No Python service; one repo, one deploy |
| Cloud | Azure (startup credits: $1k → $5k after business verify) | Cost saving; verify after MVP built locally |
| Design | Dark nav/hero, white product pages | Brand identity at entry; clarity during shopping |
| Stock reservation | Option 1 (simple decrement + restore) | Concurrent checkout conflicts won't happen at MVP scale |
| Admin auth | Email whitelist | RBAC overkill until Fayaz onboards |
| Cart persistence | DB (CartItem table) | Cart survives device switches |
| Address in Order | Snapshot (not FK) | Historical accuracy if address later changed |
| Order cancellation | Allowed up to PROCESSING only | Cannot recall package once SHIPPED |
| Refund | Automated via Razorpay API | No manual dashboard intervention; better UX |
| Direct payment links | In scope (admin-generated) | WhatsApp sales + custom/bespoke orders |
| EMI display | Razorpay Affordability Widget on PDP | Zero extra API calls; Razorpay provides it |

---

## 14. Open Items / Blockers

| Item | Owner | Status |
|---|---|---|
| BIS/916 Hallmark certificate | Anil | Waiting on GST registration |
| GST registration | Anil | In progress |
| Razorpay account activation | Nishi (needs BIS) | Blocked |
| Azure startup credits ($1k) | Nishi | Pending LinkedIn verification — do after MVP built locally |
| Azure business credits ($4k) | Nishi/Anil | Pending business verification |
| Meta WhatsApp Business API approval | Anil | Not started — needed for WhatsApp bot phase |
| Shiprocket account setup | Anil/Nishi | Not started |
| Fayaz onboarding decision | Nishi | Evaluate — candidate for admin panel ownership |
