# Vairis E-commerce Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full e-commerce website for Vairis Fine Jewellery — catalog, cart, Razorpay checkout, Shiprocket fulfillment, admin panel, and WhatsApp bot API hooks.

**Architecture:** Next.js 14 App Router on Vercel, Supabase (PostgreSQL via Prisma + Google Auth + Storage), Razorpay for payments, Shiprocket for courier. All business logic in Next.js API routes — no Supabase SDK for data access — so migrating to Azure later is a single DATABASE_URL swap.

**Tech Stack:** Next.js 14, TypeScript, Prisma ORM, Supabase, Razorpay Node SDK, Shiprocket REST API, Resend (email), Tailwind CSS, Jest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-04-23-vairis-ecommerce-design.md`

---

## File Map

```
app/
  (store)/layout.tsx            — dark nav, store shell
  (store)/page.tsx              — homepage hero
  (store)/shop/page.tsx         — all products, category filter
  (store)/shop/[category]/page.tsx — ISR category page
  (store)/shop/product/[id]/page.tsx — PDP + EMI widget, ISR 60s
  (store)/cart/page.tsx         — cart (client-side)
  (store)/checkout/page.tsx     — checkout, auth-gated
  (store)/order/confirmation/[id]/page.tsx
  (store)/order/track/[id]/page.tsx
  (store)/account/page.tsx      — orders list
  (store)/account/orders/[id]/page.tsx
  (store)/account/profile/page.tsx
  (admin)/layout.tsx            — admin shell, whitelist guard
  (admin)/dashboard/page.tsx   — gold rate widget + overview
  (admin)/products/page.tsx
  (admin)/products/new/page.tsx
  (admin)/products/[id]/edit/page.tsx
  (admin)/orders/page.tsx
  (admin)/orders/[id]/page.tsx
  (admin)/orders/payment-link/page.tsx
  auth/login/page.tsx
  auth/callback/page.tsx
  api/checkout/route.ts         — stock check, create order + Razorpay order
  api/checkout/cancel/route.ts  — restore stock on client payment failure
  api/orders/[id]/cancel/route.ts — customer cancel + refund
  api/razorpay/webhook/route.ts
  api/courier/webhook/route.ts
  api/cron/release-stock/route.ts
  api/cron/refresh-gold-rate/route.ts
  api/admin/payment-links/route.ts
  api/internal/products/route.ts
  api/internal/stock/route.ts
  api/internal/orders/route.ts
lib/
  prisma.ts                     — singleton client
  supabase.ts                   — server + browser clients
  auth.ts                       — session helpers, admin guard
  razorpay.ts                   — client + signature verify + refund
  shiprocket.ts                 — book shipment, fetch tracking
  resend.ts                     — send typed emails
  internal-auth.ts              — X-API-Key validation
  stock.ts                      — decrement/restore stock (atomic)
  pricing.ts                    — calculatePrice(variant, goldRate): PriceBreakdown
  goldprice.ts                  — GoldAPI.io fetch + GoldRate DB upsert
components/
  store/Navbar.tsx
  store/ProductCard.tsx
  store/ProductGrid.tsx
  store/CartButton.tsx
  store/EMIWidget.tsx
  store/AddressForm.tsx
  admin/ProductForm.tsx
  admin/ImageUploader.tsx
  admin/OrderTable.tsx
prisma/schema.prisma
prisma/seed.ts
middleware.ts                   — auth redirect + admin guard
vercel.json                     — cron config
.env.local.example
```

---

## Task 0: Project Setup

**Goal:** Create Supabase project, scaffold Next.js 14 app, wire all env vars.

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `.env.local.example`, `.env.local`, `vercel.json`

**Acceptance Criteria:**
- [ ] Supabase project created, Google OAuth enabled
- [ ] `npm run dev` starts without errors
- [ ] TypeScript strict mode on
- [ ] Tailwind working
- [ ] All env vars set in `.env.local` (not just `.env.local.example`)
- [ ] `npx prisma db pull` connects to Supabase DB without error

**Verify:** `npm run build` → exits 0

**Steps:**

- [ ] **Create Supabase project**

1. Go to [supabase.com](https://supabase.com) → New project
2. Name: `vairis-prod` (or `vairis-dev` for dev)
3. Set a strong DB password — **save it**, needed for `DATABASE_URL`
4. Region: Asia South (Mumbai) — closest to Indian users
5. Wait for project to provision (~1 min)

- [ ] **Collect Supabase credentials**

In Supabase dashboard → Settings → API:
- `NEXT_PUBLIC_SUPABASE_URL` = Project URL (e.g. `https://xxxx.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` = service_role key (keep secret)

In Settings → Database → Connection string → URI mode:
- `DATABASE_URL` = `postgresql://postgres:[YOUR-DB-PASSWORD]@db.xxxx.supabase.co:5432/postgres`

Note: Use **port 5432** (direct connection) for Prisma migrations. If on a serverless plan use the **pooler URL** (port 6543) for the app but keep the direct URL for migrations as `DIRECT_URL`.

- [ ] **Enable Google OAuth in Supabase**

1. Supabase dashboard → Authentication → Providers → Google → Enable
2. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com):
   - New project → APIs & Services → Credentials → OAuth 2.0 Client ID
   - Authorized redirect URIs: `https://xxxx.supabase.co/auth/v1/callback`
3. Paste Client ID + Secret into Supabase Google provider settings → Save
4. Note: add `http://localhost:3000/auth/callback` to Supabase → Auth → URL Configuration → Redirect URLs

- [ ] **Bootstrap app**

```bash
npx create-next-app@latest vairis --typescript --tailwind --eslint --app --src-dir=no
cd vairis
```

- [ ] **Install dependencies**

```bash
npm install @prisma/client prisma \
  @supabase/supabase-js @supabase/ssr \
  razorpay \
  resend \
  @types/razorpay \
  zod \
  clsx tailwind-merge
npm install -D jest @types/jest jest-environment-jsdom \
  @testing-library/react @testing-library/jest-dom \
  ts-jest
```

- [ ] **Add jest config** — create `jest.config.ts`:

```typescript
import type { Config } from 'jest'
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
}
export default config
```

- [ ] **Create `jest.setup.ts`:**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Add `.env.local.example`:**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Database (Prisma)
DATABASE_URL=

# Razorpay
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
NEXT_PUBLIC_RAZORPAY_KEY_ID=

# Shiprocket
SHIPROCKET_EMAIL=
SHIPROCKET_PASSWORD=

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@thevairis.com

# Admin
ADMIN_EMAILS=anil@thevairis.com,nishi@thevairis.com

# Internal API (WhatsApp bot)
INTERNAL_API_KEY=

# Cron auth (any random string — set same value in Vercel env vars)
CRON_SECRET=

# Gold Price API (GoldAPI.io)
GOLD_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Create `.env.local`** — copy `.env.local.example` and fill real values from the Supabase dashboard steps above:

```bash
cp .env.local.example .env.local
# Then edit .env.local and fill in:
# NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# SUPABASE_SERVICE_ROLE_KEY=eyJ...
# DATABASE_URL=postgresql://postgres:[password]@db.xxxx.supabase.co:5432/postgres
# CRON_SECRET=any-random-string-you-choose
```

`.env.local` must never be committed — verify it's in `.gitignore` (create-next-app adds it automatically).

- [ ] **Add `vercel.json`** (cron config):

```json
{
  "crons": [
    {
      "path": "/api/cron/release-stock",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/refresh-gold-rate",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: project setup, dependencies, env config"
```

---

## Task 1: Database Schema + Prisma

**Goal:** Define all Prisma models, connect to Supabase PostgreSQL, run first migration.

**Files:**
- Create: `prisma/schema.prisma`, `prisma/seed.ts`, `lib/prisma.ts`

**Acceptance Criteria:**
- [ ] `npx prisma migrate dev` succeeds
- [ ] `npx prisma studio` shows all tables including `GoldRate`
- [ ] `lib/prisma.ts` exports singleton without multiple connections in dev
- [ ] Seed creates product with variants (weight/charge fields, no `price`)
- [ ] Seed creates `GoldRate` rows for all 4 metal types

**Verify:** `npx prisma migrate dev --name init` → "Your database is now in sync"

**Steps:**

- [ ] **Write `prisma/schema.prisma`:**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

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
  images      String[]
  basePrice   Decimal
  isActive    Boolean          @default(true)
  createdAt   DateTime         @default(now())
  variants    ProductVariant[]
}

model ProductVariant {
  id                  String      @id @default(cuid())
  productId           String
  product             Product     @relation(fields: [productId], references: [id])
  metalType           MetalType
  size                String?
  weightGrams         Decimal
  makingChargePerGram Decimal
  flatMakingCharge    Decimal     @default(0)
  stoneCharges        Decimal     @default(0)
  miscCharges         Decimal     @default(0)
  stock               Int         @default(0)
  sku                 String      @unique
  cartItems           CartItem[]
  orderItems          OrderItem[]
}

model GoldRate {
  metalType   MetalType
  ratePerGram Decimal
  fetchedAt   DateTime  @updatedAt
  @@id([metalType])
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
  price       Decimal
  productName String
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
  awbCode      String?
  courierName  String?
  trackingUrl  String?
  status       String?
  updatedAt    DateTime @updatedAt
}
```

- [ ] **Write `lib/prisma.ts`:**

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['error'] : [] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Write `prisma/seed.ts`:**

```typescript
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Seed current gold rates (placeholder values — cron will overwrite with live data)
  await prisma.goldRate.createMany({
    data: [
      { metalType: 'GOLD_22K', ratePerGram: 6225 },
      { metalType: 'GOLD_18K', ratePerGram: 5100 },
      { metalType: 'SILVER_925', ratePerGram: 78 },
      { metalType: 'ROSE_GOLD', ratePerGram: 5100 },
    ],
    skipDuplicates: true,
  })

  const ring = await prisma.product.create({
    data: {
      name: 'Solitaire Ring',
      description: 'Timeless single-stone ring in 18k gold.',
      category: 'RINGS',
      images: [],
      basePrice: 15000,
      variants: {
        create: [
          { metalType: 'GOLD_18K', size: '6', weightGrams: 2.5, makingChargePerGram: 500, miscCharges: 45, stock: 3, sku: 'RING-G18K-6' },
          { metalType: 'GOLD_18K', size: '7', weightGrams: 2.5, makingChargePerGram: 500, miscCharges: 45, stock: 2, sku: 'RING-G18K-7' },
          { metalType: 'SILVER_925', size: '6', weightGrams: 8, makingChargePerGram: 50, miscCharges: 45, stock: 5, sku: 'RING-S925-6' },
        ],
      },
    },
  })
  console.log('Seeded:', ring.name)
}

main().catch(console.error).finally(() => prisma.$disconnect())
```

- [ ] **Add seed script to `package.json`:**

```json
"prisma": { "seed": "ts-node prisma/seed.ts" }
```

- [ ] **Run migration + seed**

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: prisma schema, migration, seed"
```

---

## Task 2: Supabase Auth + Google OAuth

**Goal:** Google login, session management, protected route middleware.

**Files:**
- Create: `lib/supabase.ts`, `lib/auth.ts`, `middleware.ts`, `app/auth/login/page.tsx`, `app/auth/callback/page.tsx`

**Acceptance Criteria:**
- [ ] Clicking "Sign in with Google" redirects to Google
- [ ] After Google auth, user record created in DB, session cookie set
- [ ] `/checkout` redirects to `/auth/login` if not logged in
- [ ] `/admin/*` redirects to `/auth/login` if email not in `ADMIN_EMAILS`

**Verify:** Manual — sign in with Google, check DB for User row.

**Steps:**

- [ ] **Write `lib/supabase.ts`:**

```typescript
import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )
}

export function createMiddlewareClient(req: NextRequest, res: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
      },
    }
  )
}
```

- [ ] **Write `lib/auth.ts`:**

```typescript
import { createServerSupabaseClient } from './supabase'
import { prisma } from './prisma'
import { redirect } from 'next/navigation'

export async function getSession() {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function requireUser() {
  const session = await getSession()
  if (!session) redirect('/auth/login')
  const user = await prisma.user.findUnique({ where: { email: session.user.email! } })
  if (!user) redirect('/auth/login')
  return user
}

export async function requireAdmin() {
  const session = await getSession()
  if (!session) redirect('/auth/login')
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim())
  if (!adminEmails.includes(session.user.email!)) redirect('/')
  return session
}
```

- [ ] **Write `middleware.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient(req, res)
  await supabase.auth.getSession()
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/).*)'],
}
```

- [ ] **Write `app/auth/login/page.tsx`:**

```typescript
'use client'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const supabase = createClient()

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` },
    })
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <button onClick={signInWithGoogle} className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50">
        Sign in with Google
      </button>
    </main>
  )
}
```

- [ ] **Write `app/auth/callback/page.tsx`:**

```typescript
import { createServerSupabaseClient } from '@/lib/supabase'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: { next?: string }
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (session?.user) {
    await prisma.user.upsert({
      where: { email: session.user.email! },
      update: { googleId: session.user.id },
      create: {
        email: session.user.email!,
        name: session.user.user_metadata.full_name ?? session.user.email!,
        googleId: session.user.id,
      },
    })
  }

  redirect(searchParams.next ?? '/')
}
```

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: supabase auth, google oauth, session middleware"
```

---

## Task 3: Stock Utility + Cart API

**Goal:** Atomic stock operations and persistent cart CRUD API routes.

**Files:**
- Create: `lib/stock.ts`, `app/api/cart/route.ts`, `app/api/cart/[itemId]/route.ts`
- Test: `__tests__/lib/stock.test.ts`

**Acceptance Criteria:**
- [ ] `decrementStock` throws if any variant stock would go below 0
- [ ] `restoreStock` increments correctly
- [ ] Cart add/update/remove/get routes return correct JSON
- [ ] Duplicate cart item increases quantity via upsert

**Verify:** `npx jest __tests__/lib/stock.test.ts` → all pass

**Steps:**

- [ ] **Write failing test `__tests__/lib/stock.test.ts`:**

```typescript
import { decrementStock, restoreStock } from '@/lib/stock'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    productVariant: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(prisma)),
  },
}))

const mockPrisma = prisma as jest.Mocked<typeof prisma>

describe('decrementStock', () => {
  it('throws when stock insufficient', async () => {
    mockPrisma.productVariant.findMany.mockResolvedValue([
      { id: 'v1', stock: 1 } as any,
    ])
    const items = [{ variantId: 'v1', quantity: 2 }]
    await expect(decrementStock(items)).rejects.toThrow('Insufficient stock')
  })

  it('decrements when stock sufficient', async () => {
    mockPrisma.productVariant.findMany.mockResolvedValue([
      { id: 'v1', stock: 5 } as any,
    ])
    mockPrisma.productVariant.update.mockResolvedValue({} as any)
    const items = [{ variantId: 'v1', quantity: 2 }]
    await expect(decrementStock(items)).resolves.toBeUndefined()
    expect(mockPrisma.productVariant.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: { stock: { decrement: 2 } },
    })
  })
})
```

- [ ] **Run test — expect FAIL**

```bash
npx jest __tests__/lib/stock.test.ts
```

- [ ] **Write `lib/stock.ts`:**

```typescript
import { prisma } from './prisma'

type StockItem = { variantId: string; quantity: number }

export async function decrementStock(items: StockItem[]) {
  const ids = items.map(i => i.variantId)
  const variants = await prisma.productVariant.findMany({ where: { id: { in: ids } } })

  for (const item of items) {
    const variant = variants.find(v => v.id === item.variantId)
    if (!variant || variant.stock < item.quantity) {
      throw new Error(`Insufficient stock for variant ${item.variantId}`)
    }
  }

  await prisma.$transaction(
    items.map(item =>
      prisma.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { decrement: item.quantity } },
      })
    )
  )
}

export async function restoreStock(items: StockItem[]) {
  await prisma.$transaction(
    items.map(item =>
      prisma.productVariant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } },
      })
    )
  )
}
```

- [ ] **Run test — expect PASS**

```bash
npx jest __tests__/lib/stock.test.ts
```

- [ ] **Write `app/api/cart/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const user = await requireUser()
  const items = await prisma.cartItem.findMany({
    where: { userId: user.id },
    include: { variant: { include: { product: true } } },
  })
  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const user = await requireUser()
  const { variantId, quantity } = await req.json()

  const item = await prisma.cartItem.upsert({
    where: { userId_variantId: { userId: user.id, variantId } },
    update: { quantity: { increment: quantity } },
    create: { userId: user.id, variantId, quantity },
  })
  return NextResponse.json(item, { status: 201 })
}
```

- [ ] **Write `app/api/cart/[itemId]/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: { itemId: string } }) {
  const user = await requireUser()
  const { quantity } = await req.json()
  const item = await prisma.cartItem.updateMany({
    where: { id: params.itemId, userId: user.id },
    data: { quantity },
  })
  return NextResponse.json(item)
}

export async function DELETE(_: NextRequest, { params }: { params: { itemId: string } }) {
  const user = await requireUser()
  await prisma.cartItem.deleteMany({ where: { id: params.itemId, userId: user.id } })
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: stock utility with tests, cart API routes"
```

---

## Task 4: Razorpay + Resend Lib

**Goal:** Razorpay client, signature verification, refund helper. Resend email templates.

**Files:**
- Create: `lib/razorpay.ts`, `lib/resend.ts`
- Test: `__tests__/lib/razorpay.test.ts`

**Acceptance Criteria:**
- [ ] `verifyWebhookSignature` returns true for valid signature, false for invalid
- [ ] `createRazorpayOrder` returns object with `id` field
- [ ] `sendOrderConfirmation`, `sendShippedEmail`, `sendDeliveredEmail`, `sendRefundEmail` all callable

**Verify:** `npx jest __tests__/lib/razorpay.test.ts` → all pass

**Steps:**

- [ ] **Write failing test `__tests__/lib/razorpay.test.ts`:**

```typescript
import crypto from 'crypto'
import { verifyWebhookSignature } from '@/lib/razorpay'

describe('verifyWebhookSignature', () => {
  const secret = 'test_secret'
  const body = JSON.stringify({ event: 'payment.captured' })

  it('returns true for valid signature', () => {
    const sig = crypto.createHmac('sha256', secret).update(body).digest('hex')
    expect(verifyWebhookSignature(body, sig, secret)).toBe(true)
  })

  it('returns false for invalid signature', () => {
    expect(verifyWebhookSignature(body, 'bad_sig', secret)).toBe(false)
  })
})
```

- [ ] **Run test — expect FAIL**

```bash
npx jest __tests__/lib/razorpay.test.ts
```

- [ ] **Write `lib/razorpay.ts`:**

```typescript
import Razorpay from 'razorpay'
import crypto from 'crypto'

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

export function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

export async function createRazorpayOrder(amountPaise: number, receiptId: string) {
  return razorpay.orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt: receiptId,
  })
}

export async function refundPayment(razorpayPaymentId: string, amountPaise: number) {
  return razorpay.payments.refund(razorpayPaymentId, { amount: amountPaise })
}

export async function createPaymentLink(params: {
  amount: number
  description: string
  customerName: string
  customerMobile: string
}) {
  return razorpay.paymentLink.create({
    amount: params.amount * 100,
    currency: 'INR',
    description: params.description,
    customer: { name: params.customerName, contact: params.customerMobile },
    notify: { sms: true, email: false },
    reminder_enable: false,
  })
}
```

- [ ] **Run test — expect PASS**

```bash
npx jest __tests__/lib/razorpay.test.ts
```

- [ ] **Write `lib/resend.ts`:**

```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)
const FROM = process.env.RESEND_FROM_EMAIL!

type OrderEmailParams = {
  to: string
  orderId: string
  customerName: string
  totalAmount: number
}

export async function sendOrderConfirmation(params: OrderEmailParams) {
  return resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `Order Confirmed — VAIRIS #${params.orderId.slice(-6).toUpperCase()}`,
    html: `<p>Hi ${params.customerName},</p>
           <p>Your order of ₹${params.totalAmount.toLocaleString('en-IN')} is confirmed.</p>
           <p>Order ID: ${params.orderId}</p>`,
  })
}

export async function sendShippedEmail(params: OrderEmailParams & { awbCode: string; trackingUrl: string; courierName: string }) {
  return resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `Your VAIRIS order is on the way!`,
    html: `<p>Hi ${params.customerName},</p>
           <p>Your order has been shipped via ${params.courierName}.</p>
           <p>AWB: ${params.awbCode}</p>
           <p><a href="${params.trackingUrl}">Track your order</a></p>`,
  })
}

export async function sendDeliveredEmail(params: OrderEmailParams) {
  return resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `Your VAIRIS order has been delivered!`,
    html: `<p>Hi ${params.customerName},</p>
           <p>Your jewellery has arrived. We hope you love it.</p>
           <p>Please store in a dry place away from direct sunlight.</p>`,
  })
}

export async function sendRefundEmail(params: OrderEmailParams) {
  return resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `Refund initiated for VAIRIS order #${params.orderId.slice(-6).toUpperCase()}`,
    html: `<p>Hi ${params.customerName},</p>
           <p>Your refund of ₹${params.totalAmount.toLocaleString('en-IN')} has been initiated.</p>
           <p>It will reflect in your account within 5–7 business days.</p>`,
  })
}
```

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: razorpay client + webhook verify, resend email templates"
```

---

## Task 5: Shiprocket Client

**Goal:** Shiprocket API client with token auth, shipment booking, tracking fetch.

**Files:**
- Create: `lib/shiprocket.ts`
- Test: `__tests__/lib/shiprocket.test.ts`

**Acceptance Criteria:**
- [ ] `bookShipment` calls correct Shiprocket endpoint with order data
- [ ] `getTracking` returns tracking info
- [ ] Token refresh works (Shiprocket tokens expire in 24 hrs)

**Verify:** `npx jest __tests__/lib/shiprocket.test.ts` → all pass

**Steps:**

- [ ] **Write failing test `__tests__/lib/shiprocket.test.ts`:**

```typescript
import { getShiprocketToken } from '@/lib/shiprocket'

global.fetch = jest.fn()

describe('getShiprocketToken', () => {
  it('returns token from API', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: 'test_token' }),
    })
    const token = await getShiprocketToken()
    expect(token).toBe('test_token')
    expect(fetch).toHaveBeenCalledWith(
      'https://apiv2.shiprocket.in/v1/external/auth/login',
      expect.objectContaining({ method: 'POST' })
    )
  })
})
```

- [ ] **Run test — expect FAIL**

```bash
npx jest __tests__/lib/shiprocket.test.ts
```

- [ ] **Write `lib/shiprocket.ts`:**

```typescript
const BASE = 'https://apiv2.shiprocket.in/v1/external'

let cachedToken: { token: string; expiresAt: number } | null = null

export async function getShiprocketToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token

  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.SHIPROCKET_EMAIL,
      password: process.env.SHIPROCKET_PASSWORD,
    }),
  })
  const data = await res.json()
  cachedToken = { token: data.token, expiresAt: Date.now() + 23 * 60 * 60 * 1000 }
  return data.token
}

type BookShipmentParams = {
  orderId: string
  orderDate: string
  customerName: string
  customerPhone: string
  addressLine1: string
  city: string
  state: string
  pincode: string
  items: { name: string; sku: string; qty: number; price: number }[]
  totalAmount: number
}

export async function bookShipment(params: BookShipmentParams) {
  const token = await getShiprocketToken()
  const res = await fetch(`${BASE}/orders/create/adhoc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      order_id: params.orderId,
      order_date: params.orderDate,
      pickup_location: 'Primary',
      billing_customer_name: params.customerName,
      billing_phone: params.customerPhone,
      billing_address: params.addressLine1,
      billing_city: params.city,
      billing_state: params.state,
      billing_pincode: params.pincode,
      billing_country: 'India',
      shipping_is_billing: true,
      order_items: params.items.map(i => ({
        name: i.name, sku: i.sku, units: i.qty, selling_price: i.price,
      })),
      payment_method: 'Prepaid',
      sub_total: params.totalAmount,
      length: 10, breadth: 10, height: 5, weight: 0.3,
    }),
  })
  return res.json()
}

export async function getTracking(awbCode: string) {
  const token = await getShiprocketToken()
  const res = await fetch(`${BASE}/courier/track/awb/${awbCode}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.json()
}
```

- [ ] **Run test — expect PASS**

```bash
npx jest __tests__/lib/shiprocket.test.ts
```

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: shiprocket client, token cache, book + track"
```

---

## Task 6: Checkout API + Razorpay Webhook

**Goal:** Checkout endpoint (stock check → order → Razorpay order). Razorpay webhook handler (signature verify → confirm → email → Shiprocket).

**Files:**
- Create: `app/api/checkout/route.ts`, `app/api/checkout/cancel/route.ts`, `app/api/razorpay/webhook/route.ts`
- Test: `__tests__/api/checkout.test.ts`

**Acceptance Criteria:**
- [ ] POST `/api/checkout` with insufficient stock returns 409
- [ ] POST `/api/checkout` with valid cart creates Order (PENDING) and returns razorpay_order_id
- [ ] Razorpay webhook with invalid signature returns 400
- [ ] Razorpay webhook with valid signature sets Order → PAYMENT_CONFIRMED, clears cart

**Verify:** `npx jest __tests__/api/checkout.test.ts` → all pass

**Steps:**

- [ ] **Write failing test `__tests__/api/checkout.test.ts`:**

```typescript
import { POST } from '@/app/api/checkout/route'
import { decrementStock } from '@/lib/stock'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'

jest.mock('@/lib/auth')
jest.mock('@/lib/stock')
jest.mock('@/lib/pricing', () => ({ calculatePrice: jest.fn().mockReturnValue({ total: 15000 }) }))
jest.mock('@/lib/prisma', () => ({
  prisma: {
    cartItem: { findMany: jest.fn() },
    goldRate: { findMany: jest.fn() },
    order: { create: jest.fn() },
    payment: { create: jest.fn() },
  },
}))
jest.mock('@/lib/razorpay', () => ({ createRazorpayOrder: jest.fn() }))

const mockRequireUser = requireUser as jest.Mock
const mockDecrement = decrementStock as jest.Mock
const mockPrisma = prisma as any

const mockCartItems = [{
  variantId: 'v1',
  quantity: 1,
  variant: {
    metalType: 'GOLD_18K',
    weightGrams: 2.5,
    makingChargePerGram: 500,
    flatMakingCharge: 0,
    stoneCharges: 0,
    miscCharges: 45,
    product: { name: 'Solitaire Ring' },
  },
}]

describe('POST /api/checkout', () => {
  beforeEach(() => {
    mockRequireUser.mockResolvedValue({ id: 'u1', name: 'Test', email: 'test@test.com' })
    mockPrisma.goldRate.findMany.mockResolvedValue([{ metalType: 'GOLD_18K', ratePerGram: 5100 }])
  })

  it('returns 503 when gold rates unavailable', async () => {
    mockPrisma.cartItem.findMany.mockResolvedValue(mockCartItems)
    mockPrisma.goldRate.findMany.mockResolvedValue([]) // no rates
    const req = new Request('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ addressLine1: '1 Main', city: 'Hyd', state: 'TS', pincode: '500001' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(503)
  })

  it('returns 409 when stock insufficient', async () => {
    mockPrisma.cartItem.findMany.mockResolvedValue(mockCartItems)
    mockDecrement.mockRejectedValue(new Error('Insufficient stock'))
    const req = new Request('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ addressLine1: '1 Main', city: 'Hyd', state: 'TS', pincode: '500001' }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(409)
  })
})
```

- [ ] **Run test — expect FAIL**

```bash
npx jest __tests__/api/checkout.test.ts
```

- [ ] **Write `app/api/checkout/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { decrementStock } from '@/lib/stock'
import { createRazorpayOrder } from '@/lib/razorpay'
import { calculatePrice } from '@/lib/pricing'

export async function POST(req: NextRequest) {
  const user = await requireUser()
  const body = await req.json()
  const { addressLine1, addressLine2, city, state, pincode } = body

  const cartItems = await prisma.cartItem.findMany({
    where: { userId: user.id },
    include: { variant: { include: { product: true } } },
  })

  if (cartItems.length === 0) {
    return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
  }

  // Fetch current gold rates for all metal types in cart
  const metalTypes = [...new Set(cartItems.map(i => i.variant.metalType))]
  const goldRateRows = await prisma.goldRate.findMany({ where: { metalType: { in: metalTypes } } })
  if (goldRateRows.length !== metalTypes.length) {
    return NextResponse.json({ error: 'Gold rates unavailable — try again in a moment' }, { status: 503 })
  }
  const goldRateMap: Record<string, number> = Object.fromEntries(
    goldRateRows.map(r => [r.metalType, Number(r.ratePerGram)])
  )

  try {
    await decrementStock(cartItems.map(i => ({ variantId: i.variantId, quantity: i.quantity })))
  } catch {
    return NextResponse.json({ error: 'One or more items are out of stock' }, { status: 409 })
  }

  // Calculate price per item at current gold rate (snapshot — locked into order)
  const itemPrices = new Map<string, number>()
  let totalAmount = 0
  for (const item of cartItems) {
    const { total } = calculatePrice(
      {
        weightGrams: Number(item.variant.weightGrams),
        makingChargePerGram: Number(item.variant.makingChargePerGram),
        flatMakingCharge: Number(item.variant.flatMakingCharge),
        stoneCharges: Number(item.variant.stoneCharges),
        miscCharges: Number(item.variant.miscCharges),
      },
      goldRateMap[item.variant.metalType]
    )
    itemPrices.set(item.variantId, total)
    totalAmount += total * item.quantity
  }

  const order = await prisma.order.create({
    data: {
      userId: user.id,
      status: 'PENDING',
      totalAmount,
      addressLine1, addressLine2, city, state, pincode,
      items: {
        create: cartItems.map(i => ({
          variantId: i.variantId,
          quantity: i.quantity,
          price: itemPrices.get(i.variantId)!,
          productName: i.variant.product.name,
        })),
      },
    },
  })

  const rzpOrder = await createRazorpayOrder(Math.round(totalAmount * 100), order.id)

  await prisma.payment.create({
    data: {
      orderId: order.id,
      razorpayOrderId: rzpOrder.id,
      amount: totalAmount,
      status: 'CREATED',
    },
  })

  return NextResponse.json({ orderId: order.id, razorpayOrderId: rzpOrder.id, amount: totalAmount })
}
```

- [ ] **Write `app/api/checkout/cancel/route.ts`** (payment failure — restore stock):

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { restoreStock } from '@/lib/stock'

export async function POST(req: NextRequest) {
  const user = await requireUser()
  const { orderId } = await req.json()

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: user.id, status: 'PENDING' },
    include: { items: true },
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await restoreStock(order.items.map(i => ({ variantId: i.variantId, quantity: i.quantity })))
  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Write `app/api/razorpay/webhook/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhookSignature } from '@/lib/razorpay'
import { prisma } from '@/lib/prisma'
import { bookShipment } from '@/lib/shiprocket'
import { sendOrderConfirmation } from '@/lib/resend'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''
  const secret = process.env.RAZORPAY_KEY_SECRET!

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(rawBody)

  if (event.event === 'payment.captured') {
    const rzpOrderId = event.payload.payment.entity.order_id
    const rzpPaymentId = event.payload.payment.entity.id

    const payment = await prisma.payment.findUnique({
      where: { razorpayOrderId: rzpOrderId },
      include: { order: { include: { items: true, user: true } } },
    })
    if (!payment) return NextResponse.json({ ok: true })

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { razorpayPaymentId: rzpPaymentId, status: 'CAPTURED' },
      }),
      prisma.order.update({
        where: { id: payment.orderId },
        data: { status: 'PAYMENT_CONFIRMED' },
      }),
      prisma.cartItem.deleteMany({ where: { userId: payment.order.userId } }),
    ])

    sendOrderConfirmation({
      to: payment.order.user.email,
      orderId: payment.orderId,
      customerName: payment.order.user.name,
      totalAmount: Number(payment.order.totalAmount),
    }).catch(console.error)

    const shipData = await bookShipment({
      orderId: payment.orderId,
      orderDate: new Date().toISOString().split('T')[0],
      customerName: payment.order.user.name,
      customerPhone: payment.order.user.mobile ?? '',
      addressLine1: payment.order.addressLine1,
      city: payment.order.city,
      state: payment.order.state,
      pincode: payment.order.pincode,
      items: payment.order.items.map(i => ({
        name: i.productName, sku: i.variantId, qty: i.quantity, price: Number(i.price),
      })),
      totalAmount: Number(payment.order.totalAmount),
    })

    if (shipData.shipment_id) {
      await prisma.shipment.create({
        data: {
          orderId: payment.orderId,
          shiprocketId: String(shipData.shipment_id),
          awbCode: shipData.awb_code,
          courierName: shipData.courier_name,
          trackingUrl: shipData.tracking_url ?? '',
          status: 'BOOKED',
        },
      })
      await prisma.order.update({ where: { id: payment.orderId }, data: { status: 'PROCESSING' } })
    }
  }

  if (event.event === 'payment_link.paid') {
    const rzpPaymentId = event.payload.payment.entity.id
    const linkId = event.payload.payment_link.entity.id
    await prisma.payment.updateMany({
      where: { razorpayOrderId: linkId },
      data: { razorpayPaymentId: rzpPaymentId, status: 'CAPTURED' },
    })
    await prisma.order.updateMany({
      where: { payment: { razorpayOrderId: linkId } },
      data: { status: 'PAYMENT_CONFIRMED' },
    })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Run test — expect PASS**

```bash
npx jest __tests__/api/checkout.test.ts
```

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: checkout API, razorpay webhook, payment confirmation flow"
```

---

## Task 7: Shiprocket Webhook + Cron

**Goal:** Shiprocket tracking webhook updates order status and triggers emails. Cron releases stale PENDING orders.

**Files:**
- Create: `app/api/courier/webhook/route.ts`, `app/api/cron/release-stock/route.ts`

**Acceptance Criteria:**
- [ ] Shiprocket webhook with status "Delivered" sets Order → DELIVERED, sends delivered email
- [ ] Cron endpoint finds PENDING orders older than 15 min, restores stock, marks CANCELLED
- [ ] Cron endpoint requires `Authorization: Bearer <CRON_SECRET>` (set `CRON_SECRET` in env)

**Verify:** Manual — create a PENDING order > 15 min old, hit cron endpoint, verify stock restored.

**Steps:**

- [ ] **Add `CRON_SECRET` to `.env.local.example`:**

```bash
CRON_SECRET=your_random_secret_here
```

- [ ] **Write `app/api/courier/webhook/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendShippedEmail, sendDeliveredEmail } from '@/lib/resend'

const STATUS_MAP: Record<string, string> = {
  'Shipped': 'SHIPPED',
  'In Transit': 'SHIPPED',
  'Out for Delivery': 'SHIPPED',
  'Delivered': 'DELIVERED',
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const awbCode = body.awb ?? body.awb_code
  const rawStatus: string = body.current_status ?? ''

  const shipment = await prisma.shipment.findFirst({
    where: { awbCode },
    include: { order: { include: { user: true } } },
  })
  if (!shipment) return NextResponse.json({ ok: true })

  const newStatus = STATUS_MAP[rawStatus]
  if (!newStatus) return NextResponse.json({ ok: true })

  await prisma.shipment.update({ where: { id: shipment.id }, data: { status: newStatus } })
  await prisma.order.update({ where: { id: shipment.orderId }, data: { status: newStatus as any } })

  const emailParams = {
    to: shipment.order.user.email,
    orderId: shipment.orderId,
    customerName: shipment.order.user.name,
    totalAmount: Number(shipment.order.totalAmount),
  }

  if (newStatus === 'SHIPPED') {
    sendShippedEmail({
      ...emailParams,
      awbCode: shipment.awbCode ?? '',
      trackingUrl: shipment.trackingUrl ?? '',
      courierName: shipment.courierName ?? '',
    }).catch(console.error)
  } else if (newStatus === 'DELIVERED') {
    sendDeliveredEmail(emailParams).catch(console.error)
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Write `app/api/cron/release-stock/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { restoreStock } from '@/lib/stock'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - 15 * 60 * 1000)
  const staleOrders = await prisma.order.findMany({
    where: { status: 'PENDING', createdAt: { lt: cutoff } },
    include: { items: true },
  })

  for (const order of staleOrders) {
    await restoreStock(order.items.map(i => ({ variantId: i.variantId, quantity: i.quantity })))
    await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } })
  }

  return NextResponse.json({ released: staleOrders.length })
}
```

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: shiprocket webhook, cron stock release"
```

---

## Task 8: Order Cancellation + Refund API

**Goal:** Customer cancel endpoint — guards status, restores stock, refunds via Razorpay, sends email.

**Files:**
- Create: `app/api/orders/[id]/cancel/route.ts`
- Test: `__tests__/api/cancel.test.ts`

**Acceptance Criteria:**
- [ ] Returns 400 when order is SHIPPED
- [ ] Returns 400 when order belongs to another user
- [ ] Calls Razorpay refund API when payment was captured
- [ ] Updates Order → CANCELLED, Payment → REFUNDED

**Verify:** `npx jest __tests__/api/cancel.test.ts` → all pass

**Steps:**

- [ ] **Write failing test `__tests__/api/cancel.test.ts`:**

```typescript
import { POST } from '@/app/api/orders/[id]/cancel/route'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/auth')
jest.mock('@/lib/prisma', () => ({ prisma: { order: { findFirst: jest.fn() } } }))
jest.mock('@/lib/stock')
jest.mock('@/lib/razorpay')
jest.mock('@/lib/resend')

const mockRequireUser = requireUser as jest.Mock
const mockPrisma = prisma as any

describe('POST /api/orders/[id]/cancel', () => {
  beforeEach(() => mockRequireUser.mockResolvedValue({ id: 'u1', name: 'T', email: 't@t.com' }))

  it('returns 400 when order is SHIPPED', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({
      id: 'o1', userId: 'u1', status: 'SHIPPED', items: [], payment: null,
    })
    const req = new Request('http://localhost/api/orders/o1/cancel', { method: 'POST' })
    const res = await POST(req as any, { params: { id: 'o1' } })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Run test — expect FAIL**

```bash
npx jest __tests__/api/cancel.test.ts
```

- [ ] **Write `app/api/orders/[id]/cancel/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { restoreStock } from '@/lib/stock'
import { refundPayment } from '@/lib/razorpay'
import { sendRefundEmail } from '@/lib/resend'

const NON_CANCELLABLE = ['SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireUser()

  const order = await prisma.order.findFirst({
    where: { id: params.id, userId: user.id },
    include: { items: true, payment: true },
  })

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (NON_CANCELLABLE.includes(order.status)) {
    return NextResponse.json({ error: `Cannot cancel order with status ${order.status}` }, { status: 400 })
  }

  await restoreStock(order.items.map(i => ({ variantId: i.variantId, quantity: i.quantity })))

  if (order.payment?.razorpayPaymentId && order.payment.status === 'CAPTURED') {
    const amountPaise = Math.round(Number(order.totalAmount) * 100)
    await refundPayment(order.payment.razorpayPaymentId, amountPaise)
    await prisma.payment.update({ where: { id: order.payment.id }, data: { status: 'REFUNDED' } })
    sendRefundEmail({
      to: user.email,
      orderId: order.id,
      customerName: user.name,
      totalAmount: Number(order.totalAmount),
    }).catch(console.error)
  }

  await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Run test — expect PASS**

```bash
npx jest __tests__/api/cancel.test.ts
```

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: order cancellation + automated razorpay refund"
```

---

## Task 9: Direct Payment Links API

**Goal:** Admin generates Razorpay payment links; webhook auto-creates Order on payment.

**Files:**
- Create: `app/api/admin/payment-links/route.ts`

**Acceptance Criteria:**
- [ ] Non-admin gets 403
- [ ] Returns Razorpay short URL on success
- [ ] Creates Payment record linked to the link ID

**Verify:** Manual — hit endpoint with admin session, verify Razorpay dashboard shows link.

**Steps:**

- [ ] **Write `app/api/admin/payment-links/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createPaymentLink } from '@/lib/razorpay'

export async function POST(req: NextRequest) {
  await requireAdmin()
  const { customerName, customerMobile, amount, description } = await req.json()

  const link = await createPaymentLink({ amount, description, customerName, customerMobile })

  // Create a stub order + payment to track this link
  const order = await prisma.order.create({
    data: {
      // Payment link orders don't have a user account — use sentinel
      userId: 'PAYMENT_LINK',
      status: 'PENDING',
      totalAmount: amount,
      addressLine1: 'TBD', city: 'TBD', state: 'TBD', pincode: 'TBD',
    },
  })

  await prisma.payment.create({
    data: {
      orderId: order.id,
      razorpayOrderId: link.id,
      amount,
      status: 'CREATED',
    },
  })

  return NextResponse.json({ url: link.short_url, linkId: link.id })
}
```

- [ ] **Note:** The `PAYMENT_LINK` sentinel userId requires a dummy User row in DB. Add to seed:

```typescript
await prisma.user.upsert({
  where: { email: 'paymentlink@thevairis.com' },
  update: {},
  create: { id: 'PAYMENT_LINK', name: 'Payment Link', email: 'paymentlink@thevairis.com' },
})
```

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: admin payment links API, razorpay payment_link.paid webhook"
```

---

## Task 10: Internal API (WhatsApp Bot Hooks)

**Goal:** API key-protected endpoints for WhatsApp bot to query products, stock, and orders.

**Files:**
- Create: `lib/internal-auth.ts`, `app/api/internal/products/route.ts`, `app/api/internal/stock/route.ts`, `app/api/internal/orders/route.ts`
- Test: `__tests__/lib/internal-auth.test.ts`

**Acceptance Criteria:**
- [ ] Request without `X-API-Key` returns 401
- [ ] Request with wrong key returns 401
- [ ] Products endpoint returns filtered results by category/name
- [ ] Stock endpoint returns `available: boolean` for a variantId

**Verify:** `npx jest __tests__/lib/internal-auth.test.ts` → all pass

**Steps:**

- [ ] **Write failing test `__tests__/lib/internal-auth.test.ts`:**

```typescript
import { validateInternalKey } from '@/lib/internal-auth'

process.env.INTERNAL_API_KEY = 'secret123'

describe('validateInternalKey', () => {
  it('returns true for correct key', () => {
    expect(validateInternalKey('secret123')).toBe(true)
  })
  it('returns false for wrong key', () => {
    expect(validateInternalKey('wrong')).toBe(false)
  })
  it('returns false for empty key', () => {
    expect(validateInternalKey('')).toBe(false)
  })
})
```

- [ ] **Run test — expect FAIL**

```bash
npx jest __tests__/lib/internal-auth.test.ts
```

- [ ] **Write `lib/internal-auth.ts`:**

```typescript
export function validateInternalKey(key: string): boolean {
  const expected = process.env.INTERNAL_API_KEY
  if (!expected || !key) return false
  return key === expected
}
```

- [ ] **Run test — expect PASS**

```bash
npx jest __tests__/lib/internal-auth.test.ts
```

- [ ] **Write `app/api/internal/products/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { validateInternalKey } from '@/lib/internal-auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  if (!validateInternalKey(req.headers.get('x-api-key') ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')?.toUpperCase()
  const name = searchParams.get('name')
  const maxPrice = searchParams.get('maxPrice')

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(category && { category: category as any }),
      ...(name && { name: { contains: name, mode: 'insensitive' } }),
      ...(maxPrice && { basePrice: { lte: Number(maxPrice) } }),
    },
    include: { variants: { where: { stock: { gt: 0 } } } },
    take: 10,
  })

  return NextResponse.json(products)
}
```

- [ ] **Write `app/api/internal/stock/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { validateInternalKey } from '@/lib/internal-auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  if (!validateInternalKey(req.headers.get('x-api-key') ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const variantId = new URL(req.url).searchParams.get('variantId')
  if (!variantId) return NextResponse.json({ error: 'variantId required' }, { status: 400 })

  const variant = await prisma.productVariant.findUnique({ where: { id: variantId } })
  return NextResponse.json({ variantId, available: (variant?.stock ?? 0) > 0, stock: variant?.stock ?? 0 })
}
```

- [ ] **Write `app/api/internal/orders/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { validateInternalKey } from '@/lib/internal-auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  if (!validateInternalKey(req.headers.get('x-api-key') ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orderId = new URL(req.url).searchParams.get('orderId')
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 })

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { shipment: true },
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    orderId: order.id,
    status: order.status,
    trackingUrl: order.shipment?.trackingUrl,
    awbCode: order.shipment?.awbCode,
    courierName: order.shipment?.courierName,
  })
}
```

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: internal API routes for WhatsApp bot, API key auth"
```

---

## Task 11: Admin Panel Pages

**Goal:** Admin product CRUD (with image upload), orders list + detail + ship action.

**Files:**
- Create: `app/(admin)/layout.tsx`, `app/(admin)/products/page.tsx`, `app/(admin)/products/new/page.tsx`, `app/(admin)/products/[id]/edit/page.tsx`, `app/(admin)/orders/page.tsx`, `app/(admin)/orders/[id]/page.tsx`, `app/(admin)/orders/payment-link/page.tsx`, `components/admin/ProductForm.tsx`, `components/admin/ImageUploader.tsx`, `components/admin/OrderTable.tsx`

**Acceptance Criteria:**
- [ ] Non-admin email redirected to `/`
- [ ] Can create product with up to 5 images uploaded to Supabase Storage
- [ ] Can add/edit variants (metal type, size, weightGrams, makingChargePerGram, flatMakingCharge, stoneCharges, miscCharges, stock)
- [ ] Dashboard shows current `GoldRate` rows with `fetchedAt` timestamp
- [ ] Orders list shows status badge, filterable by status
- [ ] Order detail shows "Book Shipment" button when status is PAYMENT_CONFIRMED
- [ ] Payment link form generates and displays copyable Razorpay URL

**Verify:** Manual — log in as admin, create product, upload image, view in catalog.

**Steps:**

- [ ] **Write `app/(admin)/layout.tsx`:**

```typescript
import { requireAdmin } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex gap-6 text-sm">
        <a href="/admin/products" className="font-medium text-gray-700 hover:text-black">Products</a>
        <a href="/admin/orders" className="font-medium text-gray-700 hover:text-black">Orders</a>
        <a href="/admin/orders/payment-link" className="font-medium text-gray-700 hover:text-black">Payment Links</a>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  )
}
```

- [ ] **Write `components/admin/ImageUploader.tsx`:**

```typescript
'use client'
import { createClient } from '@/lib/supabase'
import { useState } from 'react'

export function ImageUploader({ onUploaded }: { onUploaded: (url: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const supabase = createClient()

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const path = `products/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('product-images').upload(path, file)
    if (!error) {
      const { data } = supabase.storage.from('product-images').getPublicUrl(path)
      onUploaded(data.publicUrl)
    }
    setUploading(false)
  }

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} />
      {uploading && <span className="text-sm text-gray-500 ml-2">Uploading...</span>}
    </div>
  )
}
```

- [ ] **Write `app/(admin)/products/new/page.tsx`** (product create form — calls server action):

```typescript
'use client'
import { useState } from 'react'
import { ImageUploader } from '@/components/admin/ImageUploader'
import { useRouter } from 'next/navigation'

export default function NewProductPage() {
  const router = useRouter()
  const [images, setImages] = useState<string[]>([])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    await fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: fd.get('name'),
        description: fd.get('description'),
        category: fd.get('category'),
        basePrice: Number(fd.get('basePrice')),
        images,
      }),
    })
    router.push('/admin/products')
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <input name="name" placeholder="Product name" required className="w-full border rounded p-2" />
      <textarea name="description" placeholder="Description" className="w-full border rounded p-2" />
      <select name="category" className="w-full border rounded p-2">
        {['RINGS', 'EARRINGS', 'NECKLACES', 'BRACELETS'].map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <input name="basePrice" type="number" placeholder="Display price / from price (₹) — shown in listings" required className="w-full border rounded p-2" />
      <div>
        <p className="text-sm font-medium mb-2">Images (max 5)</p>
        {images.map((url, i) => <img key={i} src={url} alt="" className="h-16 w-16 object-cover inline mr-2 rounded" />)}
        {images.length < 5 && <ImageUploader onUploaded={url => setImages(prev => [...prev, url])} />}
      </div>
      <hr className="my-2" />
      <p className="text-sm font-semibold">Variant Pricing (per variant, add after product is created)</p>
      <p className="text-xs text-gray-500">weightGrams × goldRate + (weightGrams × makingChargePerGram) + flatMakingCharge + stoneCharges + miscCharges + GST = price shown to customer</p>
      <button type="submit" className="bg-black text-white px-4 py-2 rounded">Create Product</button>
    </form>
  )
}
```

- [ ] **Add `app/api/admin/products/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  await requireAdmin()
  const { name, description, category, basePrice, images } = await req.json()
  const product = await prisma.product.create({
    data: { name, description, category, basePrice, images },
  })
  return NextResponse.json(product, { status: 201 })
}
```

- [ ] **Write `app/(admin)/orders/payment-link/page.tsx`:**

```typescript
'use client'
import { useState } from 'react'

export default function PaymentLinkPage() {
  const [url, setUrl] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const res = await fetch('/api/admin/payment-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: fd.get('customerName'),
        customerMobile: fd.get('customerMobile'),
        amount: Number(fd.get('amount')),
        description: fd.get('description'),
      }),
    })
    const data = await res.json()
    setUrl(data.url)
  }

  return (
    <div className="max-w-md">
      <h1 className="text-xl font-bold mb-4">Generate Payment Link</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input name="customerName" placeholder="Customer name" required className="w-full border rounded p-2" />
        <input name="customerMobile" placeholder="Mobile number" required className="w-full border rounded p-2" />
        <input name="amount" type="number" placeholder="Amount (₹)" required className="w-full border rounded p-2" />
        <input name="description" placeholder="Description (e.g. Custom ring)" className="w-full border rounded p-2" />
        <button type="submit" className="bg-black text-white px-4 py-2 rounded w-full">Generate Link</button>
      </form>
      {url && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
          <p className="text-sm font-medium mb-1">Share this link:</p>
          <a href={url} target="_blank" className="text-blue-600 break-all text-sm">{url}</a>
          <button onClick={() => navigator.clipboard.writeText(url)} className="mt-2 text-xs text-gray-500 underline block">
            Copy to clipboard
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Write `app/(admin)/dashboard/page.tsx`** (gold rate widget + admin home):

```typescript
import { prisma } from '@/lib/prisma'

export default async function AdminDashboardPage() {
  const goldRates = await prisma.goldRate.findMany()

  function minsAgo(date: Date) {
    return Math.floor((Date.now() - new Date(date).getTime()) / 60000)
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Dashboard</h1>
      <div className="bg-white border rounded p-4 max-w-sm">
        <p className="text-sm font-semibold mb-3 text-gray-700">Live Gold Rates</p>
        {goldRates.length === 0 ? (
          <p className="text-sm text-red-500">No rates cached — cron has not run yet. Run <code>/api/cron/refresh-gold-rate</code> manually or wait up to 30 min.</p>
        ) : (
          <table className="text-sm w-full">
            <tbody>
              {goldRates.map(r => (
                <tr key={r.metalType} className="border-t">
                  <td className="py-1 text-gray-600">{r.metalType.replace('_', ' ')}</td>
                  <td className="py-1 font-medium">₹{Number(r.ratePerGram).toLocaleString('en-IN')}/g</td>
                  <td className="py-1 text-xs text-gray-400">{minsAgo(r.fetchedAt)} min ago</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Update `app/(admin)/layout.tsx`** to add Dashboard nav link:

```typescript
import { requireAdmin } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex gap-6 text-sm">
        <a href="/admin" className="font-medium text-gray-700 hover:text-black">Dashboard</a>
        <a href="/admin/products" className="font-medium text-gray-700 hover:text-black">Products</a>
        <a href="/admin/orders" className="font-medium text-gray-700 hover:text-black">Orders</a>
        <a href="/admin/orders/payment-link" className="font-medium text-gray-700 hover:text-black">Payment Links</a>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: admin panel — products CRUD, image upload, orders, payment links, gold rate dashboard"
```

---

## Task 12: Customer-Facing Pages (Store UI)

**Goal:** Homepage, catalog, product detail (PDP with EMI widget), cart page, account pages, order tracking.

**Files:**
- Create: `app/(store)/layout.tsx`, `app/(store)/page.tsx`, `app/(store)/shop/page.tsx`, `app/(store)/shop/[category]/page.tsx`, `app/(store)/shop/product/[id]/page.tsx`, `app/(store)/cart/page.tsx`, `app/(store)/checkout/page.tsx`, `app/(store)/order/confirmation/[id]/page.tsx`, `app/(store)/order/track/[id]/page.tsx`, `app/(store)/account/page.tsx`, `app/(store)/account/orders/[id]/page.tsx`, `components/store/Navbar.tsx`, `components/store/ProductCard.tsx`, `components/store/EMIWidget.tsx`

**Acceptance Criteria:**
- [ ] Catalog page shows products, filterable by category tab
- [ ] PDP shows product images gallery, variant selector (metal + size), price breakdown (gold value / making charges / stone charges / misc / GST / total), EMI widget, "Add to Cart"
- [ ] PDP shows "Gold rate: ₹X/g  •  Last updated N min ago"
- [ ] Cart shows items, quantities, total, note about gold rate, "Proceed to Checkout"
- [ ] Checkout page shows address form + cart summary + "Place Order" button
- [ ] After successful payment, redirected to `/order/confirmation/[id]`
- [ ] Order tracking page shows current status + tracking link if shipped

**Verify:** Manual — browse catalog, add to cart, proceed through checkout in Razorpay test mode.

**Steps:**

- [ ] **Write `app/(store)/layout.tsx`:**

```typescript
import { Navbar } from '@/components/store/Navbar'

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
    </>
  )
}
```

- [ ] **Write `components/store/Navbar.tsx`:**

```typescript
import Link from 'next/link'

export function Navbar() {
  return (
    <nav style={{ background: '#0f2418', padding: '20px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Link href="/" style={{ color: '#c9a84c', letterSpacing: '0.3em', fontWeight: 500, textDecoration: 'none' }}>
        VAIRIS
      </Link>
      <ul style={{ display: 'flex', gap: 32, listStyle: 'none' }}>
        {[['Shop', '/shop'], ['Cart', '/cart'], ['Account', '/account']].map(([label, href]) => (
          <li key={href}>
            <Link href={href} style={{ color: 'rgba(201,168,76,0.7)', fontSize: 13, letterSpacing: '0.2em', textDecoration: 'none' }}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
```

- [ ] **Write `app/(store)/shop/[category]/page.tsx`** (ISR, revalidate 60s):

```typescript
import { prisma } from '@/lib/prisma'
import { ProductCard } from '@/components/store/ProductCard'
import { Category } from '@prisma/client'

export const revalidate = 60

export async function generateStaticParams() {
  return (['RINGS', 'EARRINGS', 'NECKLACES', 'BRACELETS'] as Category[]).map(c => ({
    category: c.toLowerCase(),
  }))
}

export default async function CategoryPage({ params }: { params: { category: string } }) {
  const category = params.category.toUpperCase() as Category
  const products = await prisma.product.findMany({
    where: { category, isActive: true },
    include: { variants: { take: 1 } },
  })

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-6 capitalize">{params.category}</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map(p => <ProductCard key={p.id} product={p} />)}
      </div>
    </div>
  )
}
```

- [ ] **Write `components/store/ProductCard.tsx`:**

```typescript
import Link from 'next/link'
import Image from 'next/image'

type Props = {
  product: { id: string; name: string; images: string[]; basePrice: any }
}

export function ProductCard({ product }: Props) {
  return (
    <Link href={`/shop/product/${product.id}`} className="group block">
      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-3">
        {product.images[0] && (
          <Image
            src={product.images[0]}
            alt={product.name}
            width={400}
            height={400}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform"
          />
        )}
      </div>
      <p className="text-sm font-medium text-gray-900">{product.name}</p>
      <p className="text-sm text-amber-700 font-semibold mt-1">
        ₹{Number(product.basePrice).toLocaleString('en-IN')}
      </p>
    </Link>
  )
}
```

- [ ] **Write `components/store/EMIWidget.tsx`** (Razorpay Affordability Widget):

```typescript
'use client'
import { useEffect } from 'react'

declare global {
  interface Window { RazorpayAffordability?: any }
}

export function EMIWidget({ amount }: { amount: number }) {
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://cdn.razorpay.com/widgets/affordability/widget.js'
    script.onload = () => {
      if (window.RazorpayAffordability) {
        new window.RazorpayAffordability({
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: amount * 100,
        }).render()
      }
    }
    document.body.appendChild(script)
    return () => { document.body.removeChild(script) }
  }, [amount])

  return <div id="razorpay-affordability-widget" className="mt-4" />
}
```

- [ ] **Write `app/(store)/shop/product/[id]/page.tsx`** (ISR, variant selector, add to cart):

```typescript
'use client' // needs state for variant selection
import { useEffect, useState } from 'react'
import { EMIWidget } from '@/components/store/EMIWidget'
import { useRouter } from 'next/navigation'

// Server component wrapper handles data fetch, client component handles interaction
// For brevity: use a client component that fetches on mount
export default function ProductPage({ params }: { params: { id: string } }) {
  const [product, setProduct] = useState<any>(null)
  const [goldRates, setGoldRates] = useState<Record<string, number>>({})
  const [selectedVariant, setSelectedVariant] = useState<any>(null)
  const [adding, setAdding] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch(`/api/products/${params.id}`).then(r => r.json()).then(p => {
      setProduct(p)
      setGoldRates(p?.goldRates ?? {})
      setSelectedVariant(p?.variants?.[0])
    })
  }, [params.id])

  async function addToCart() {
    if (!selectedVariant) return
    setAdding(true)
    const res = await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variantId: selectedVariant.id, quantity: 1 }),
    })
    if (res.status === 401) router.push('/auth/login?next=/cart')
    else router.push('/cart')
    setAdding(false)
  }

  if (!product) return <div className="p-8">Loading...</div>

  const metals = [...new Set(product.variants.map((v: any) => v.metalType))]
  const sizes = [...new Set(product.variants.filter((v: any) => v.metalType === selectedVariant?.metalType).map((v: any) => v.size).filter(Boolean))]

  return (
    <div className="max-w-4xl mx-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="space-y-2">
        {product.images.map((url: string, i: number) => (
          <img key={i} src={url} alt={product.name} className="w-full rounded-lg" />
        ))}
      </div>
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{product.name}</h1>
        {selectedVariant && goldRates[selectedVariant.metalType] ? (() => {
          const rate = goldRates[selectedVariant.metalType]
          const gv = Number(selectedVariant.weightGrams) * rate
          const mc = Number(selectedVariant.weightGrams) * Number(selectedVariant.makingChargePerGram) + Number(selectedVariant.flatMakingCharge)
          const gst = gv * 0.03 + mc * 0.05
          const total = gv + mc + Number(selectedVariant.stoneCharges) + Number(selectedVariant.miscCharges) + gst
          return (
            <div className="mt-3 text-sm border rounded p-3 bg-amber-50">
              <div className="flex justify-between"><span className="text-gray-600">Gold Value</span><span>₹{gv.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Making Charges</span><span>₹{mc.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></div>
              {Number(selectedVariant.stoneCharges) > 0 && <div className="flex justify-between"><span className="text-gray-600">Stone Charges</span><span>₹{Number(selectedVariant.stoneCharges).toLocaleString('en-IN')}</span></div>}
              {Number(selectedVariant.miscCharges) > 0 && <div className="flex justify-between"><span className="text-gray-600">Misc (Hallmark etc.)</span><span>₹{Number(selectedVariant.miscCharges).toLocaleString('en-IN')}</span></div>}
              <div className="flex justify-between"><span className="text-gray-600">GST (3%+5%)</span><span>₹{gst.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></div>
              <div className="flex justify-between font-bold border-t mt-1 pt-1 text-base"><span>Total</span><span className="text-amber-700">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span></div>
              <p className="text-xs text-gray-400 mt-1">Gold rate: ₹{rate.toLocaleString('en-IN')}/g</p>
            </div>
          )
        })() : (
          <p className="mt-2 text-amber-700 font-bold text-xl">₹{Number(product.basePrice).toLocaleString('en-IN')}</p>
        )}
        <p className="text-gray-600 mt-3 text-sm leading-relaxed">{product.description}</p>

        <div className="mt-4">
          <p className="text-sm font-medium mb-2">Metal</p>
          <div className="flex gap-2 flex-wrap">
            {metals.map((m: any) => (
              <button key={m}
                onClick={() => setSelectedVariant(product.variants.find((v: any) => v.metalType === m))}
                className={`px-3 py-1 border rounded text-sm ${selectedVariant?.metalType === m ? 'border-black bg-black text-white' : 'border-gray-300'}`}>
                {m.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {sizes.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium mb-2">Size</p>
            <div className="flex gap-2 flex-wrap">
              {sizes.map((s: any) => (
                <button key={s}
                  onClick={() => setSelectedVariant(product.variants.find((v: any) => v.metalType === selectedVariant?.metalType && v.size === s))}
                  className={`w-10 h-10 border rounded text-sm ${selectedVariant?.size === s ? 'border-black bg-black text-white' : 'border-gray-300'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedVariant?.stock === 0 && (
          <p className="mt-3 text-red-500 text-sm">Currently in high demand — check back soon</p>
        )}

        <button
          onClick={addToCart}
          disabled={adding || selectedVariant?.stock === 0}
          className="mt-6 w-full py-3 bg-black text-white rounded-lg disabled:opacity-50">
          {adding ? 'Adding...' : 'Add to Cart'}
        </button>

        <EMIWidget amount={
          selectedVariant && goldRates[selectedVariant.metalType]
            ? (() => {
                const rate = goldRates[selectedVariant.metalType]
                const gv = Number(selectedVariant.weightGrams) * rate
                const mc = Number(selectedVariant.weightGrams) * Number(selectedVariant.makingChargePerGram) + Number(selectedVariant.flatMakingCharge)
                const gst = gv * 0.03 + mc * 0.05
                return gv + mc + Number(selectedVariant.stoneCharges) + Number(selectedVariant.miscCharges) + gst
              })()
            : Number(product.basePrice)
        } />
      </div>
    </div>
  )
}
```

- [ ] **Add `app/api/products/[id]/route.ts`** (public, for PDP fetch):

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const product = await prisma.product.findUnique({
    where: { id: params.id, isActive: true },
    include: { variants: true },
  })
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Include current gold rates for all metal types present in variants
  const metalTypes = [...new Set(product.variants.map(v => v.metalType))]
  const goldRateRows = await prisma.goldRate.findMany({ where: { metalType: { in: metalTypes } } })
  const goldRates: Record<string, number> = Object.fromEntries(
    goldRateRows.map(r => [r.metalType, Number(r.ratePerGram)])
  )

  return NextResponse.json({ ...product, goldRates })
}
```

- [ ] **Write `app/(store)/checkout/page.tsx`** (Razorpay SDK integration):

```typescript
'use client'
import { useState } from 'react'

declare global { interface Window { Razorpay: any } }

export default function CheckoutPage() {
  const [loading, setLoading] = useState(false)
  const [address, setAddress] = useState({ addressLine1: '', city: '', state: '', pincode: '' })

  async function handlePlaceOrder() {
    setLoading(true)
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(address),
    })

    if (!res.ok) {
      const err = await res.json()
      alert(err.error)
      setLoading(false)
      return
    }

    const { razorpayOrderId, amount, orderId } = await res.json()

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    document.body.appendChild(script)
    script.onload = () => {
      const rzp = new window.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        order_id: razorpayOrderId,
        amount: amount * 100,
        currency: 'INR',
        name: 'VAIRIS Fine Jewellery',
        handler: () => {
          window.location.href = `/order/confirmation/${orderId}`
        },
        modal: {
          ondismiss: async () => {
            await fetch('/api/checkout/cancel', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId }),
            })
            setLoading(false)
          },
        },
      })
      rzp.open()
    }
  }

  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-xl font-semibold mb-6">Checkout</h1>
      <div className="space-y-3 mb-6">
        {(['addressLine1', 'city', 'state', 'pincode'] as const).map(field => (
          <input key={field} placeholder={field} value={address[field]}
            onChange={e => setAddress(a => ({ ...a, [field]: e.target.value }))}
            className="w-full border rounded p-2 text-sm" />
        ))}
      </div>
      <button onClick={handlePlaceOrder} disabled={loading}
        className="w-full py-3 bg-black text-white rounded-lg disabled:opacity-50">
        {loading ? 'Processing...' : 'Place Order'}
      </button>
    </div>
  )
}
```

- [ ] **Write `app/(store)/order/track/[id]/page.tsx`:**

```typescript
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'

export default async function TrackOrderPage({ params }: { params: { id: string } }) {
  const user = await requireUser()
  const order = await prisma.order.findFirst({
    where: { id: params.id, userId: user.id },
    include: { shipment: true, items: true },
  })
  if (!order) return <div className="p-8">Order not found.</div>

  return (
    <div className="max-w-lg mx-auto p-8">
      <h1 className="text-xl font-semibold mb-4">Order #{order.id.slice(-6).toUpperCase()}</h1>
      <p className="text-sm text-gray-500 mb-6">Status: <span className="font-medium text-gray-900">{order.status}</span></p>
      {order.shipment?.trackingUrl && (
        <a href={order.shipment.trackingUrl} target="_blank"
          className="inline-block px-4 py-2 border rounded text-sm hover:bg-gray-50">
          Track with {order.shipment.courierName}
        </a>
      )}
      {order.status === 'PROCESSING' || order.status === 'PAYMENT_CONFIRMED' ? (
        <p className="mt-4 text-sm text-gray-500">Your order is being prepared for shipment.</p>
      ) : null}
    </div>
  )
}
```

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: store pages — catalog, PDP, cart, checkout, order tracking"
```

---

## Task 13: SEO — Sitemap, Robots, OG Tags

**Goal:** sitemap.xml, robots.txt, OG meta tags on all public pages.

**Files:**
- Create: `app/sitemap.ts`, `app/robots.ts`
- Modify: `app/(store)/shop/[category]/page.tsx`, `app/(store)/shop/product/[id]/page.tsx`

**Acceptance Criteria:**
- [ ] `/sitemap.xml` returns valid XML with all product and category URLs
- [ ] `/robots.txt` allows all, disallows `/admin` and `/api`
- [ ] Product detail pages have OG title + description + image

**Verify:** `curl http://localhost:3000/sitemap.xml` → XML with product URLs

**Steps:**

- [ ] **Write `app/robots.ts`:**

```typescript
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin', '/api', '/account'] },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL}/sitemap.xml`,
  }
}
```

- [ ] **Write `app/sitemap.ts`:**

```typescript
import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL!
  const categories = ['rings', 'earrings', 'necklaces', 'bracelets']
  const products = await prisma.product.findMany({ where: { isActive: true }, select: { id: true, updatedAt: true } })

  return [
    { url: base, lastModified: new Date() },
    { url: `${base}/shop`, lastModified: new Date() },
    ...categories.map(c => ({ url: `${base}/shop/${c}`, lastModified: new Date() })),
    ...products.map(p => ({ url: `${base}/shop/product/${p.id}`, lastModified: p.updatedAt })),
  ]
}
```

- [ ] **Add OG metadata to `app/(store)/shop/product/[id]/page.tsx`** — convert the server data-fetch part to a separate `generateMetadata` export. Add at top of the file (before default export):

```typescript
export async function generateMetadata({ params }: { params: { id: string } }) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/products/${params.id}`)
  const product = await res.json()
  return {
    title: `${product.name} | VAIRIS Fine Jewellery`,
    description: product.description,
    openGraph: {
      title: `${product.name} | VAIRIS`,
      description: product.description,
      images: product.images?.[0] ? [{ url: product.images[0] }] : [],
    },
  }
}
```

- [ ] **Add root layout metadata in `app/layout.tsx`:**

```typescript
export const metadata = {
  title: { default: 'VAIRIS Fine Jewellery', template: '%s | VAIRIS' },
  description: 'Where heritage meets the extraordinary. Fine jewellery, reimagined.',
  openGraph: {
    siteName: 'VAIRIS Fine Jewellery',
    images: [{ url: '/images/vairis_main.jpeg' }],
  },
}
```

- [ ] **Commit**

```bash
git add -A && git commit -m "feat: SEO — sitemap.xml, robots.txt, OG metadata"
```

---

## Task 14: Deploy to Vercel + Env Config

**Goal:** Deploy to Vercel, connect domain, configure all env vars, verify cron works.

**Files:**
- No code changes — configuration only

**Acceptance Criteria:**
- [ ] Site live at thevairis.com
- [ ] All env vars set in Vercel dashboard
- [ ] `/api/cron/release-stock` shows in Vercel Cron panel
- [ ] `/api/cron/refresh-gold-rate` shows in Vercel Cron panel
- [ ] `GOLD_API_KEY` set in Vercel env vars
- [ ] Razorpay test payment works end-to-end on production URL
- [ ] Supabase redirect URLs include production domain

**Verify:** Place test order with Razorpay test card `4111 1111 1111 1111` → confirmation page loads.

**Steps:**

- [ ] **Install Vercel CLI and deploy**

```bash
npm i -g vercel
vercel --prod
```

- [ ] **Set all env vars in Vercel dashboard** (Settings → Environment Variables) — copy from `.env.local.example`

- [ ] **Add production URL to Supabase Auth redirect allow-list:**
  - Supabase Dashboard → Auth → URL Configuration
  - Add: `https://thevairis.com/auth/callback`

- [ ] **Add Razorpay webhook endpoint in Razorpay dashboard:**
  - URL: `https://thevairis.com/api/razorpay/webhook`
  - Events: `payment.captured`, `payment_link.paid`

- [ ] **Add Shiprocket webhook:**
  - URL: `https://thevairis.com/api/courier/webhook`

- [ ] **Verify crons** — check Vercel dashboard → Cron Jobs → confirm `/api/cron/release-stock` fires every 5 min and `/api/cron/refresh-gold-rate` fires every 30 min

- [ ] **Test end-to-end with Razorpay test mode:**
  - Card: `4111 1111 1111 1111`, expiry any future date, CVV `111`
  - Place order → confirm → check DB for PAYMENT_CONFIRMED order

- [ ] **Tag release**

```bash
git tag v0.1.0 && git push origin v0.1.0
```

---

## Task 15: `lib/pricing.ts` — Price Calculation Library

**Goal:** Pure TypeScript function that calculates `PriceBreakdown` from variant fields and current gold rate per gram.

**Files:**
- Create: `lib/pricing.ts`
- Test: `__tests__/lib/pricing.test.ts`

**Acceptance Criteria:**
- [ ] `calculatePrice` returns correct `goldValue`, `making`, `gst`, `total`
- [ ] GST: 3% on goldValue + 5% on making (not a flat rate)
- [ ] `flatMakingCharge` added to making correctly
- [ ] `stoneCharges` and `miscCharges` pass through without GST

**Verify:** `npx jest __tests__/lib/pricing.test.ts` → all pass

**Steps:**

- [ ] **Write failing test `__tests__/lib/pricing.test.ts`:**

```typescript
import { calculatePrice } from '@/lib/pricing'

describe('calculatePrice', () => {
  const variant = {
    weightGrams: 2.5,
    makingChargePerGram: 400,
    flatMakingCharge: 0,
    stoneCharges: 0,
    miscCharges: 45,
  }

  it('calculates goldValue correctly', () => {
    const result = calculatePrice(variant, 5100)
    // goldValue = 2.5 × 5100 = 12750
    expect(result.goldValue).toBeCloseTo(12750)
  })

  it('calculates making charges correctly', () => {
    const result = calculatePrice(variant, 5100)
    // making = 2.5 × 400 = 1000
    expect(result.making).toBeCloseTo(1000)
  })

  it('calculates GST: 3% on gold + 5% on making', () => {
    const result = calculatePrice(variant, 5100)
    // gst = 12750 × 0.03 + 1000 × 0.05 = 382.5 + 50 = 432.5
    expect(result.gst).toBeCloseTo(432.5)
  })

  it('calculates total correctly', () => {
    const result = calculatePrice(variant, 5100)
    // total = 12750 + 1000 + 0 + 45 + 432.5 = 14227.5
    expect(result.total).toBeCloseTo(14227.5)
  })

  it('includes flatMakingCharge in making', () => {
    const result = calculatePrice({ ...variant, flatMakingCharge: 200 }, 5100)
    // making = 2.5 × 400 + 200 = 1200
    expect(result.making).toBeCloseTo(1200)
  })

  it('passes stoneCharges through without GST', () => {
    const result = calculatePrice({ ...variant, stoneCharges: 5000 }, 5100)
    expect(result.stoneCharges).toBe(5000)
    // gst unchanged: still based on goldValue + making only
    expect(result.gst).toBeCloseTo(432.5)
  })
})
```

- [ ] **Run test — expect FAIL**

```bash
npx jest __tests__/lib/pricing.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/pricing'"

- [ ] **Write `lib/pricing.ts`:**

```typescript
export interface PriceBreakdown {
  goldValue: number
  making: number
  stoneCharges: number
  miscCharges: number
  gst: number
  total: number
}

export function calculatePrice(
  variant: {
    weightGrams: number
    makingChargePerGram: number
    flatMakingCharge: number
    stoneCharges: number
    miscCharges: number
  },
  goldRatePerGram: number
): PriceBreakdown {
  const goldValue = variant.weightGrams * goldRatePerGram
  const making = (variant.weightGrams * variant.makingChargePerGram) + variant.flatMakingCharge
  const gst = (goldValue * 0.03) + (making * 0.05)
  const total = goldValue + making + variant.stoneCharges + variant.miscCharges + gst
  return {
    goldValue,
    making,
    stoneCharges: variant.stoneCharges,
    miscCharges: variant.miscCharges,
    gst,
    total,
  }
}
```

- [ ] **Run test — expect PASS**

```bash
npx jest __tests__/lib/pricing.test.ts
```

Expected: 6 tests pass

- [ ] **Commit**

```bash
git add lib/pricing.ts __tests__/lib/pricing.test.ts
git commit -m "feat: add pricing calculation library with GST breakdown"
```

---

## Task 16: `lib/goldprice.ts` + Gold Rate Cron

**Goal:** Fetch live gold/silver rates from GoldAPI.io, cache per-purity rates in `GoldRate` table, expose a cron route to trigger refresh.

**Files:**
- Create: `lib/goldprice.ts`
- Create: `app/api/cron/refresh-gold-rate/route.ts`
- Test: `__tests__/lib/goldprice.test.ts`

**Acceptance Criteria:**
- [ ] `fetchAndCacheRates()` upserts 4 rows into `GoldRate` table
- [ ] ROSE_GOLD rate = 18K rate
- [ ] SILVER_925 rate = 24K silver × 0.925
- [ ] Cron route returns 401 without `Authorization: Bearer <CRON_SECRET>`
- [ ] Cron route returns `{ ok: true }` with correct token

**Verify:** `npx jest __tests__/lib/goldprice.test.ts` → all pass

**Steps:**

- [ ] **Write failing test `__tests__/lib/goldprice.test.ts`:**

```typescript
import { fetchAndCacheRates } from '@/lib/goldprice'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    goldRate: { upsert: jest.fn().mockResolvedValue({}) },
  },
}))

global.fetch = jest.fn()

const mockFetch = fetch as jest.Mock
const mockPrisma = prisma as any

describe('fetchAndCacheRates', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch
      .mockResolvedValueOnce({ json: async () => ({ price_gram_22k: 6225, price_gram_18k: 5100 }) })
      .mockResolvedValueOnce({ json: async () => ({ price_gram_24k: 84.4 }) })
  })

  it('calls GoldAPI.io for XAU and XAG', async () => {
    await fetchAndCacheRates()
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.goldapi.io/api/XAU/INR',
      expect.objectContaining({ headers: expect.objectContaining({ 'x-access-token': expect.any(String) }) })
    )
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.goldapi.io/api/XAG/INR',
      expect.objectContaining({ headers: expect.objectContaining({ 'x-access-token': expect.any(String) }) })
    )
  })

  it('upserts 4 GoldRate rows', async () => {
    await fetchAndCacheRates()
    expect(mockPrisma.goldRate.upsert).toHaveBeenCalledTimes(4)
  })

  it('upserts ROSE_GOLD at 18K rate', async () => {
    await fetchAndCacheRates()
    expect(mockPrisma.goldRate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { metalType: 'ROSE_GOLD' }, update: expect.objectContaining({ ratePerGram: 5100 }) })
    )
  })

  it('upserts SILVER_925 at 92.5% of 24K silver rate', async () => {
    await fetchAndCacheRates()
    // 84.4 × 0.925 = 78.07
    expect(mockPrisma.goldRate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { metalType: 'SILVER_925' }, update: expect.objectContaining({ ratePerGram: expect.closeTo(78.07, 1) }) })
    )
  })
})
```

- [ ] **Run test — expect FAIL**

```bash
npx jest __tests__/lib/goldprice.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/goldprice'"

- [ ] **Write `lib/goldprice.ts`:**

```typescript
import { prisma } from './prisma'

export async function fetchAndCacheRates(): Promise<void> {
  const [goldRes, silverRes] = await Promise.all([
    fetch('https://www.goldapi.io/api/XAU/INR', {
      headers: { 'x-access-token': process.env.GOLD_API_KEY! },
    }),
    fetch('https://www.goldapi.io/api/XAG/INR', {
      headers: { 'x-access-token': process.env.GOLD_API_KEY! },
    }),
  ])
  const gold = await goldRes.json()
  const silver = await silverRes.json()

  const upserts: Array<{ metalType: string; ratePerGram: number }> = [
    { metalType: 'GOLD_22K', ratePerGram: gold.price_gram_22k },
    { metalType: 'GOLD_18K', ratePerGram: gold.price_gram_18k },
    { metalType: 'ROSE_GOLD', ratePerGram: gold.price_gram_18k },
    { metalType: 'SILVER_925', ratePerGram: silver.price_gram_24k * 0.925 },
  ]

  await Promise.all(
    upserts.map(u =>
      prisma.goldRate.upsert({
        where: { metalType: u.metalType as any },
        update: { ratePerGram: u.ratePerGram },
        create: { metalType: u.metalType as any, ratePerGram: u.ratePerGram },
      })
    )
  )
}
```

- [ ] **Run test — expect PASS**

```bash
npx jest __tests__/lib/goldprice.test.ts
```

Expected: 4 tests pass

- [ ] **Write `app/api/cron/refresh-gold-rate/route.ts`:**

```typescript
import { fetchAndCacheRates } from '@/lib/goldprice'

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  await fetchAndCacheRates()
  return Response.json({ ok: true, refreshedAt: new Date().toISOString() })
}
```

- [ ] **Verify cron auth manually**

```bash
# Without token — expect 401
curl http://localhost:3000/api/cron/refresh-gold-rate

# With token — expect { ok: true }
curl -H "Authorization: Bearer test-secret" http://localhost:3000/api/cron/refresh-gold-rate
```

Note: set `CRON_SECRET=test-secret` in `.env.local` for local testing. In production, Vercel sets this automatically and passes it in the `Authorization` header.

- [ ] **Commit**

```bash
git add lib/goldprice.ts app/api/cron/refresh-gold-rate/route.ts __tests__/lib/goldprice.test.ts
git commit -m "feat: gold rate fetching from GoldAPI.io, cron refresh route"
```

---

## Task Dependencies

```
Task 0 (Setup)
  └── Task 1 (DB Schema) ← includes GoldRate model + updated ProductVariant
        ├── Task 15 (pricing.ts lib) ← NEW
        ├── Task 16 (goldprice.ts + cron) ← NEW
        └── Task 2 (Auth)
              ├── Task 3 (Stock + Cart API)
              │     └── Task 4 (Razorpay + Resend lib)
              │           └── Task 5 (Shiprocket lib)
              │                 └── Task 6 (Checkout + Webhook) ← needs Task 15 + 16
              │                       ├── Task 7 (Shiprocket webhook + Cron)
              │                       ├── Task 8 (Cancel + Refund)
              │                       └── Task 9 (Payment Links)
              ├── Task 10 (Internal API)
              ├── Task 11 (Admin Pages) ← needs Task 6; dashboard needs GoldRate data
              └── Task 12 (Store Pages) ← needs Tasks 3,4,6,15,16
                    └── Task 13 (SEO)
                          └── Task 14 (Deploy)
```
